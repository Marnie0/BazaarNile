import { OrderStatus, Prisma, ProductStatus, Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSeller } from '../middleware/seller.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

export const sellerRouter = Router();
sellerRouter.use('/seller', requireAuth);

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  _count: { select: { orderItems: true } },
} as const;

const productSchema = z.object({
  name: z.string().trim().min(3).max(120), description: z.string().trim().min(20).max(3000),
  price: z.coerce.number().positive().max(99_999_999),
  compareAt: z.union([z.coerce.number().positive().max(99_999_999), z.literal(''), z.null()]).optional(),
  imageUrl: z.url().max(1000), images: z.array(z.url().max(1000)).max(8).optional(),
  inventory: z.coerce.number().int().min(0).max(1_000_000), categoryId: z.string().min(1),
  status: z.enum(ProductStatus).default(ProductStatus.ACTIVE),
});

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'product';
async function uniqueSlug(name: string, excludeId?: string) {
  const base = slugify(name); let slug = base; let suffix = 1;
  while (await prisma.product.findFirst({ where: { slug, ...(excludeId && { id: { not: excludeId } }) }, select: { id: true } })) {
    suffix += 1; slug = `${base}-${suffix}`;
  }
  return slug;
}

sellerRouter.post('/seller/enroll', asyncHandler(async (req, res) => {
  if (req.user!.role === Role.ADMIN) return res.json({ role: Role.ADMIN });
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { role: Role.SELLER }, select: { role: true } });
  res.json(user);
}));
sellerRouter.use('/seller', requireSeller);

sellerRouter.get('/seller/overview', asyncHandler(async (req, res) => {
  const sellerId = req.user!.id; const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - 13);
  const [products, orderItems] = await prisma.$transaction([
    prisma.product.findMany({ where: { sellerId }, orderBy: { createdAt: 'desc' }, include: productInclude }),
    prisma.orderItem.findMany({ where: { sellerId, order: { status: { not: OrderStatus.CANCELLED } } }, orderBy: { createdAt: 'desc' },
      include: { order: { select: { orderNumber: true, status: true, shippingName: true, createdAt: true } } } }),
  ]);
  const revenue = orderItems.filter((item) => item.order.status === OrderStatus.DELIVERED)
    .reduce((sum, item) => sum.plus(item.lineTotal), new Prisma.Decimal(0));
  const grossSales = orderItems.reduce((sum, item) => sum.plus(item.lineTotal), new Prisma.Decimal(0));
  const chart = Array.from({ length: 14 }, (_, offset) => {
    const day = new Date(since); day.setDate(since.getDate() + offset); const next = new Date(day); next.setDate(day.getDate() + 1);
    const total = orderItems.filter((item) => item.order.createdAt >= day && item.order.createdAt < next)
      .reduce((sum, item) => sum.plus(item.lineTotal), new Prisma.Decimal(0));
    return { date: day.toISOString().slice(0, 10), revenue: total.toString() };
  });
  const productSales = new Map<string, { productName: string; units: number; revenue: Prisma.Decimal }>();
  for (const item of orderItems) {
    const current = productSales.get(item.productSlug) ?? { productName: item.productName, units: 0, revenue: new Prisma.Decimal(0) };
    current.units += item.quantity; current.revenue = current.revenue.plus(item.lineTotal); productSales.set(item.productSlug, current);
  }
  res.json({ metrics: { revenue: revenue.toString(), grossSales: grossSales.toString(),
    unitsSold: orderItems.reduce((sum, item) => sum + item.quantity, 0), totalProducts: products.length,
    activeProducts: products.filter((product) => product.status === ProductStatus.ACTIVE).length,
    lowStock: products.filter((product) => product.inventory > 0 && product.inventory <= 5).length,
    outOfStock: products.filter((product) => product.inventory === 0).length }, chart, recentSales: orderItems.slice(0, 6),
    topProducts: [...productSales.values()].sort((a, b) => b.units - a.units).slice(0, 5)
      .map((item) => ({ ...item, revenue: item.revenue.toString() })) });
}));

sellerRouter.get('/seller/products', asyncHandler(async (req, res) => {
  const query = z.object({ search: z.string().trim().max(100).optional(), status: z.enum(ProductStatus).optional() }).parse(req.query);
  const products = await prisma.product.findMany({ where: { sellerId: req.user!.id, ...(query.status && { status: query.status }),
    ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }) }, orderBy: { updatedAt: 'desc' }, include: productInclude });
  res.json({ products });
}));
sellerRouter.get('/seller/products/:id', asyncHandler(async (req, res) => {
  const id = z.string().parse(req.params.id);
  const product = await prisma.product.findFirst({ where: { id, sellerId: req.user!.id }, include: productInclude });
  if (!product) throw new AppError(404, 'Product not found'); res.json({ product });
}));

sellerRouter.post('/seller/products', asyncHandler(async (req, res) => {
  const data = productSchema.parse(req.body);
  if (!(await prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } }))) throw new AppError(400, 'Category not found');
  const product = await prisma.product.create({ data: { ...data, status: data.status === ProductStatus.DRAFT ? ProductStatus.DRAFT : ProductStatus.PENDING,
    compareAt: data.compareAt === '' || data.compareAt == null ? null : data.compareAt,
    images: data.images?.length ? data.images : [data.imageUrl], slug: await uniqueSlug(data.name), sellerId: req.user!.id }, include: productInclude });
  res.status(201).json({ product });
}));

sellerRouter.patch('/seller/products/:id', asyncHandler(async (req, res) => {
  const id = z.string().parse(req.params.id); const existing = await prisma.product.findFirst({ where: { id, sellerId: req.user!.id } });
  if (!existing) throw new AppError(404, 'Product not found'); const data = productSchema.partial().parse(req.body);
  if (data.categoryId && !(await prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } }))) throw new AppError(400, 'Category not found');
  const requestedStatus = data.status;
  const status = requestedStatus === ProductStatus.ACTIVE
    ? (existing.status === ProductStatus.ACTIVE ? ProductStatus.ACTIVE : ProductStatus.PENDING)
    : requestedStatus === ProductStatus.REJECTED
      ? (existing.status === ProductStatus.REJECTED ? ProductStatus.REJECTED : ProductStatus.PENDING)
      : requestedStatus;
  const product = await prisma.product.update({ where: { id }, data: { ...data, status,
    ...(data.compareAt !== undefined && { compareAt: data.compareAt === '' || data.compareAt == null ? null : data.compareAt }),
    ...(data.name && data.name !== existing.name && { slug: await uniqueSlug(data.name, id) }),
    ...(data.imageUrl && !data.images && { images: existing.images.length ? existing.images : [data.imageUrl] }) }, include: productInclude });
  res.json({ product });
}));

sellerRouter.delete('/seller/products/:id', asyncHandler(async (req, res) => {
  const id = z.string().parse(req.params.id);
  const product = await prisma.product.findFirst({ where: { id, sellerId: req.user!.id }, select: { id: true, _count: { select: { orderItems: true } } } });
  if (!product) throw new AppError(404, 'Product not found');
  if (product._count.orderItems > 0) { await prisma.product.update({ where: { id }, data: { status: ProductStatus.ARCHIVED } }); return res.json({ archived: true }); }
  await prisma.product.delete({ where: { id } }); res.status(204).send();
}));
