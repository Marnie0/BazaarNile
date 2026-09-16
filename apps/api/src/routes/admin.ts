import { OrderStatus, Prisma, ProductStatus, Role, UserStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/admin.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const safeUser = {
  id: true, email: true, username: true, displayName: true, avatarUrl: true,
  role: true, status: true, createdAt: true, updatedAt: true,
  _count: { select: { products: true, orders: true } },
} as const;

adminRouter.get('/admin/overview', asyncHandler(async (_req, res) => {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 13);
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [totalUsers, newUsers, sellers, suspendedUsers, totalProducts, activeProducts, pendingProducts, orders, recentUsers] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.user.count({ where: { role: Role.SELLER } }),
    prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
    prisma.product.count(),
    prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
    prisma.product.count({ where: { status: ProductStatus.PENDING } }),
    prisma.order.findMany({
      where: { status: { not: OrderStatus.CANCELLED } },
      select: { id: true, subtotal: true, createdAt: true, items: { select: { sellerId: true, lineTotal: true } } },
    }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 6, select: safeUser }),
  ]);

  const grossMerchandiseValue = orders.reduce((sum, order) => sum.plus(order.subtotal), new Prisma.Decimal(0));
  const chart = Array.from({ length: 14 }, (_, offset) => {
    const day = new Date(since);
    day.setDate(since.getDate() + offset);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const daily = orders.filter((order) => order.createdAt >= day && order.createdAt < next);
    return {
      date: day.toISOString().slice(0, 10),
      revenue: daily.reduce((sum, order) => sum.plus(order.subtotal), new Prisma.Decimal(0)).toString(),
      orders: daily.length,
    };
  });

  const sellerSales = new Map<string, { revenue: Prisma.Decimal; orders: Set<string>; units: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const current = sellerSales.get(item.sellerId) ?? { revenue: new Prisma.Decimal(0), orders: new Set<string>(), units: 0 };
      current.revenue = current.revenue.plus(item.lineTotal);
      current.orders.add(order.id);
      current.units += 1;
      sellerSales.set(item.sellerId, current);
    }
  }
  const topSellerIds = [...sellerSales.entries()].sort((a, b) => b[1].revenue.comparedTo(a[1].revenue)).slice(0, 5).map(([id]) => id);
  const sellerProfiles = await prisma.user.findMany({ where: { id: { in: topSellerIds } }, select: { id: true, displayName: true, username: true, avatarUrl: true } });
  const profileMap = new Map(sellerProfiles.map((profile) => [profile.id, profile]));
  const topSellers = topSellerIds.map((id) => ({ ...profileMap.get(id), revenue: sellerSales.get(id)!.revenue.toString(), orders: sellerSales.get(id)!.orders.size }));

  res.json({
    metrics: {
      totalUsers, newUsers, sellers, suspendedUsers, totalProducts, activeProducts, pendingProducts,
      totalOrders: orders.length, grossMerchandiseValue: grossMerchandiseValue.toString(),
      averageOrderValue: orders.length ? grossMerchandiseValue.div(orders.length).toFixed(2) : '0',
    },
    chart, topSellers, recentUsers,
  });
}));

adminRouter.get('/admin/users', asyncHandler(async (req, res) => {
  const query = z.object({
    search: z.string().trim().max(100).optional(), role: z.enum(Role).optional(), status: z.enum(UserStatus).optional(),
    page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(50).default(20),
  }).parse(req.query);
  const where: Prisma.UserWhereInput = {
    ...(query.role && { role: query.role }), ...(query.status && { status: query.status }),
    ...(query.search && { OR: [
      { displayName: { contains: query.search, mode: 'insensitive' } },
      { username: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ] }),
  };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit, select: safeUser }),
    prisma.user.count({ where }),
  ]);
  res.json({ users, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
}));

adminRouter.patch('/admin/users/:id', asyncHandler(async (req, res) => {
  const id = z.string().parse(req.params.id);
  const data = z.object({ role: z.enum(Role).optional(), status: z.enum(UserStatus).optional() }).refine((value) => Object.keys(value).length > 0).parse(req.body);
  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
  if (!existing) throw new AppError(404, 'User not found');
  if (id === req.user!.id && (data.status === UserStatus.SUSPENDED || (data.role && data.role !== Role.ADMIN))) {
    throw new AppError(409, 'You cannot remove your own administrator access');
  }
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data, select: safeUser });
    if (data.status === UserStatus.SUSPENDED) {
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return updated;
  });
  res.json({ user });
}));

adminRouter.get('/admin/products', asyncHandler(async (req, res) => {
  const query = z.object({
    search: z.string().trim().max(100).optional(), status: z.enum(ProductStatus).optional(),
    page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(50).default(20),
  }).parse(req.query);
  const where: Prisma.ProductWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.search && { OR: [
      { name: { contains: query.search, mode: 'insensitive' } },
      { seller: { displayName: { contains: query.search, mode: 'insensitive' } } },
    ] }),
  };
  const include = {
    category: { select: { id: true, name: true, slug: true } },
    seller: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    _count: { select: { orderItems: true } },
  } as const;
  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit, include }),
    prisma.product.count({ where }),
  ]);
  res.json({ products, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
}));

adminRouter.patch('/admin/products/:id/moderate', asyncHandler(async (req, res) => {
  const id = z.string().parse(req.params.id);
  const { status } = z.object({ status: z.enum([ProductStatus.ACTIVE, ProductStatus.REJECTED, ProductStatus.ARCHIVED]) }).parse(req.body);
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError(404, 'Product not found');
  const product = await prisma.product.update({
    where: { id }, data: { status },
    include: { category: true, seller: { select: { id: true, username: true, displayName: true, avatarUrl: true } }, _count: { select: { orderItems: true } } },
  });
  res.json({ product });
}));
