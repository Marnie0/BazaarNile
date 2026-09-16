import { ProductStatus, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';
import { requireAuth } from '../middleware/auth.js';

export const catalogRouter = Router();

catalogRouter.get('/categories', asyncHandler(async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: { where: { status: ProductStatus.ACTIVE } } } } },
  });
  res.json({ categories });
}));

catalogRouter.get('/products', asyncHandler(async (req, res) => {
  const query = z.object({
    search: z.string().trim().max(100).optional(), category: z.string().optional(),
    featured: z.enum(['true', 'false']).optional(), page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(48).default(12),
    sort: z.enum(['newest', 'price-asc', 'price-desc']).default('newest'),
  }).parse(req.query);
  const where: Prisma.ProductWhereInput = {
    status: ProductStatus.ACTIVE,
    ...(query.category && { category: { slug: query.category } }),
    ...(query.featured && { featured: query.featured === 'true' }),
    ...(query.search && { OR: [
      { name: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ]}),
  };
  const orderBy = query.sort === 'price-asc' ? { price: 'asc' as const } : query.sort === 'price-desc' ? { price: 'desc' as const } : { createdAt: 'desc' as const };
  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({ where, orderBy, skip: (query.page - 1) * query.limit, take: query.limit,
      include: { category: { select: { name: true, slug: true } }, seller: { select: { username: true, displayName: true, avatarUrl: true } } } }),
    prisma.product.count({ where }),
  ]);
  res.json({ products, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
}));

catalogRouter.get('/products/:slug', asyncHandler(async (req, res) => {
  const slug = z.string().parse(req.params.slug);
  const product = await prisma.product.findFirst({
    where: { slug, status: ProductStatus.ACTIVE },
    include: { category: true, seller: { select: { username: true, displayName: true, avatarUrl: true, bio: true } } },
  });
  if (!product) throw new AppError(404, 'Product not found');
  res.json({ product });
}));

catalogRouter.post('/products/:productId/views', requireAuth, asyncHandler(async (req, res) => {
  const productId = z.string().min(1).parse(req.params.productId);
  const product = await prisma.product.findFirst({ where: { id: productId, status: ProductStatus.ACTIVE }, select: { id: true } });
  if (!product) throw new AppError(404, 'Product not found');
  await prisma.productView.upsert({
    where: { userId_productId: { userId: req.user!.id, productId } },
    create: { userId: req.user!.id, productId },
    update: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
  });
  res.status(204).send();
}));

const recommendationWords = (value: string) => new Set(
  value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3),
);

catalogRouter.get('/recommendations', requireAuth, asyncHandler(async (req, res) => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(12).default(4) }).parse(req.query);
  const views = await prisma.productView.findMany({
    where: { userId: req.user!.id },
    orderBy: { lastViewedAt: 'desc' },
    take: 20,
    include: { product: { select: { id: true, name: true, description: true, price: true, categoryId: true } } },
  });
  const viewedIds = views.map((view) => view.productId);
  const candidates = await prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE, inventory: { gt: 0 }, id: { notIn: viewedIds } },
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    include: { category: { select: { name: true, slug: true } }, seller: { select: { username: true, displayName: true, avatarUrl: true } } },
  });

  if (!views.length) {
    res.json({ products: candidates.slice(0, limit), personalized: false, reason: 'Popular picks to get you started' });
    return;
  }

  const now = Date.now();
  const interests = views.map((view) => {
    const ageDays = Math.max(0, (now - view.lastViewedAt.getTime()) / 86_400_000);
    return {
      ...view,
      weight: (1 + Math.log2(view.viewCount + 1)) * Math.exp(-ageDays / 30),
      words: recommendationWords(`${view.product.name} ${view.product.description}`),
    };
  });
  const averagePrice = interests.reduce((sum, view) => sum + Number(view.product.price) * view.weight, 0)
    / interests.reduce((sum, view) => sum + view.weight, 0);
  const scored = candidates.map((product) => {
    const words = recommendationWords(`${product.name} ${product.description}`);
    let categoryScore = 0; let textScore = 0;
    for (const view of interests) {
      if (view.product.categoryId === product.categoryId) categoryScore += 5 * view.weight;
      let matches = 0;
      words.forEach((word) => { if (view.words.has(word)) matches += 1; });
      textScore += Math.min(matches, 4) * view.weight;
    }
    const priceDistance = Math.abs(Number(product.price) - averagePrice) / Math.max(averagePrice, 1);
    const priceScore = Math.max(0, 3 - priceDistance * 3);
    return { product, score: categoryScore + textScore + priceScore + (product.featured ? 1 : 0) };
  }).sort((a, b) => b.score - a.score);
  res.json({ products: scored.slice(0, limit).map(({ product }) => product), personalized: true, reason: 'Inspired by products you viewed' });
}));

catalogRouter.get('/profiles/:username', asyncHandler(async (req, res) => {
  const username = z.string().parse(req.params.username).toLowerCase();
  const user = await prisma.user.findUnique({
    where: { username },
    select: { username: true, displayName: true, avatarUrl: true, bio: true, role: true, createdAt: true,
      products: { where: { status: ProductStatus.ACTIVE }, orderBy: { createdAt: 'desc' }, include: { category: true } } },
  });
  if (!user) throw new AppError(404, 'Profile not found');
  res.json({ user });
}));
