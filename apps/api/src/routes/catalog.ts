import { ProductStatus, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

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
