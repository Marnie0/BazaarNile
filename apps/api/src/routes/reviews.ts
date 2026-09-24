import { NotificationType, OrderStatus, Prisma, ProductStatus, Role } from '@prisma/client';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { PostgresRateLimitStore } from '../lib/rate-limit-store.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

export const reviewsRouter = Router();

const reviewLimiter = rateLimit({
  windowMs: 60 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.user!.id, store: new PostgresRateLimitStore('reviews'), passOnStoreError: true,
  message: { message: 'You have written a lot of reviews in a short time. Please try again later' },
});

const reviewSelect = {
  id: true, rating: true, title: true, body: true, verified: true, createdAt: true, updatedAt: true,
  user: { select: { username: true, displayName: true, avatarUrl: true } },
} as const;

// Recomputed in SQL so the product's updatedAt (used for moderation sorting) is untouched.
async function refreshRating(tx: Prisma.TransactionClient, productId: string) {
  await tx.$executeRaw`
    UPDATE "Product" SET "reviewCount" = stats.count, "ratingAverage" = COALESCE(stats.average, 0)
    FROM (SELECT COUNT(*)::int AS count, ROUND(AVG("rating")::numeric, 2) AS average FROM "Review" WHERE "productId" = ${productId}) AS stats
    WHERE "Product"."id" = ${productId}`;
}

const hasDelivered = (userId: string, productId: string) => prisma.orderItem.findFirst({
  where: { productId, order: { userId, status: OrderStatus.DELIVERED } }, select: { id: true },
}).then(Boolean);

async function activeProduct(productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, status: ProductStatus.ACTIVE }, select: { id: true, name: true, slug: true, sellerId: true } });
  if (!product) throw new AppError(404, 'Product not found');
  return product;
}

reviewsRouter.get('/products/:productId/reviews', asyncHandler(async (req, res) => {
  const productId = z.string().min(1).max(40).parse(req.params.productId);
  const query = z.object({
    sort: z.enum(['recent', 'highest', 'lowest']).default('recent'), rating: z.coerce.number().int().min(1).max(5).optional(),
    page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(20).default(6),
  }).parse(req.query);
  await activeProduct(productId);
  const where: Prisma.ReviewWhereInput = { productId, ...(query.rating && { rating: query.rating }) };
  const orderBy: Prisma.ReviewOrderByWithRelationInput[] = query.sort === 'highest' ? [{ rating: 'desc' }, { createdAt: 'desc' }]
    : query.sort === 'lowest' ? [{ rating: 'asc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }, { id: 'desc' }];
  const [reviews, total, groups] = await Promise.all([
    prisma.review.findMany({ where, orderBy, skip: (query.page - 1) * query.limit, take: query.limit, select: reviewSelect }),
    prisma.review.count({ where }),
    prisma.review.groupBy({ by: ['rating'], where: { productId }, _count: { _all: true } }),
  ]);
  const distribution = Object.fromEntries([5, 4, 3, 2, 1].map((rating) => [rating, groups.find((group) => group.rating === rating)?._count._all ?? 0]));
  const count = groups.reduce((sum, group) => sum + group._count._all, 0);
  const average = count ? groups.reduce((sum, group) => sum + group.rating * group._count._all, 0) / count : 0;
  res.json({ reviews, summary: { average: Math.round(average * 100) / 100, count, distribution },
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
}));

reviewsRouter.get('/products/:productId/reviews/mine', requireAuth, asyncHandler(async (req, res) => {
  const productId = z.string().min(1).max(40).parse(req.params.productId);
  const product = await activeProduct(productId);
  const [review, verifiedPurchase] = await Promise.all([
    prisma.review.findUnique({ where: { productId_userId: { productId, userId: req.user!.id } }, select: reviewSelect }),
    hasDelivered(req.user!.id, productId),
  ]);
  const ownListing = product.sellerId === req.user!.id;
  res.json({ review, canReview: !ownListing, reason: ownListing ? 'You can’t review your own listing' : undefined, verifiedPurchase });
}));

const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Choose a star rating').max(5),
  title: z.string().trim().max(80, 'Keep the headline under 80 characters').optional().transform((value) => value || null),
  body: z.string().trim().min(10, 'Tell other shoppers a little more — at least 10 characters').max(2000, 'Reviews can be up to 2,000 characters'),
});

reviewsRouter.put('/products/:productId/reviews/mine', requireAuth, reviewLimiter, asyncHandler(async (req, res) => {
  const productId = z.string().min(1).max(40).parse(req.params.productId);
  const data = reviewSchema.parse(req.body);
  const product = await activeProduct(productId);
  if (product.sellerId === req.user!.id) throw new AppError(403, 'You can’t review your own listing');
  const verified = await hasDelivered(req.user!.id, productId);
  const { review, created } = await prisma.$transaction(async (tx) => {
    const existing = await tx.review.findUnique({ where: { productId_userId: { productId, userId: req.user!.id } }, select: { id: true } });
    const saved = await tx.review.upsert({
      where: { productId_userId: { productId, userId: req.user!.id } },
      create: { ...data, verified, productId, userId: req.user!.id }, update: { ...data, verified }, select: reviewSelect,
    });
    await refreshRating(tx, productId);
    if (!existing) await tx.notification.create({ data: { userId: product.sellerId, type: NotificationType.SELLER,
      title: `New ${data.rating}-star review`, message: `${saved.user.displayName} reviewed ${product.name}.`, link: `/products/${product.slug}#reviews` } });
    return { review: saved, created: !existing };
  });
  res.status(created ? 201 : 200).json({ review });
}));

reviewsRouter.delete('/products/:productId/reviews/mine', requireAuth, asyncHandler(async (req, res) => {
  const productId = z.string().min(1).max(40).parse(req.params.productId);
  await prisma.$transaction(async (tx) => {
    const removed = await tx.review.deleteMany({ where: { productId, userId: req.user!.id } });
    if (!removed.count) throw new AppError(404, 'Review not found');
    await refreshRating(tx, productId);
  });
  res.status(204).send();
}));

// Moderation: administrators can remove a review that breaks the rules.
reviewsRouter.delete('/admin/reviews/:id', requireAuth, asyncHandler(async (req, res) => {
  if (req.user!.role !== Role.ADMIN) throw new AppError(403, 'Administrator access required');
  const id = z.string().min(1).max(40).parse(req.params.id);
  await prisma.$transaction(async (tx) => {
    const review = await tx.review.findUnique({ where: { id }, select: { productId: true } });
    if (!review) throw new AppError(404, 'Review not found');
    await tx.review.delete({ where: { id } });
    await refreshRating(tx, review.productId);
  });
  res.status(204).send();
}));
