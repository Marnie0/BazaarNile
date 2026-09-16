import { CouponType, NotificationType, OrderStatus, Prisma, ProductStatus, Role, UserStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/admin.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

export const adminRouter = Router();
adminRouter.use('/admin', requireAuth, requireAdmin);

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

  const [totalUsers, newUsers, sellers, suspendedUsers, totalProducts, activeProducts, pendingProducts, totalOrders, openOrders, orders, recentUsers] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.user.count({ where: { role: Role.SELLER } }),
    prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
    prisma.product.count(),
    prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
    prisma.product.count({ where: { status: ProductStatus.PENDING } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] } } }),
    prisma.order.findMany({
      where: { status: { not: OrderStatus.CANCELLED } },
      select: { id: true, userId: true, subtotal: true, discount: true, createdAt: true, items: { select: { sellerId: true, lineTotal: true, quantity: true, product: { select: { category: { select: { name: true } } } } } } },
    }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 6, select: safeUser }),
  ]);

  const grossMerchandiseValue = orders.reduce((sum, order) => sum.plus(order.subtotal), new Prisma.Decimal(0));
  const totalDiscounts = orders.reduce((sum, order) => sum.plus(order.discount), new Prisma.Decimal(0));
  const customerOrders = new Map<string, number>();
  orders.forEach((order) => customerOrders.set(order.userId, (customerOrders.get(order.userId) ?? 0) + 1));
  const repeatCustomerRate = customerOrders.size ? [...customerOrders.values()].filter((count) => count > 1).length / customerOrders.size * 100 : 0;
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
      current.units += item.quantity;
      sellerSales.set(item.sellerId, current);
    }
  }
  const topSellerIds = [...sellerSales.entries()].sort((a, b) => b[1].revenue.comparedTo(a[1].revenue)).slice(0, 5).map(([id]) => id);
  const sellerProfiles = await prisma.user.findMany({ where: { id: { in: topSellerIds } }, select: { id: true, displayName: true, username: true, avatarUrl: true } });
  const profileMap = new Map(sellerProfiles.map((profile) => [profile.id, profile]));
  const topSellers = topSellerIds.map((id) => ({ ...profileMap.get(id), revenue: sellerSales.get(id)!.revenue.toString(), orders: sellerSales.get(id)!.orders.size }));
  const categoryMap = new Map<string, { revenue: Prisma.Decimal; units: number }>();
  for (const order of orders) for (const item of order.items) {
    const name = item.product?.category.name ?? 'Archived products'; const current = categoryMap.get(name) ?? { revenue: new Prisma.Decimal(0), units: 0 };
    current.revenue = current.revenue.plus(item.lineTotal); current.units += item.quantity; categoryMap.set(name, current);
  }
  const categorySales = [...categoryMap.entries()].map(([name, value]) => ({ name, revenue: value.revenue.toString(), units: value.units }))
    .sort((a, b) => Number(b.revenue) - Number(a.revenue)).slice(0, 5);

  res.json({
    metrics: {
      totalUsers, newUsers, sellers, suspendedUsers, totalProducts, activeProducts, pendingProducts,
      totalOrders, openOrders, grossMerchandiseValue: grossMerchandiseValue.toString(),
      averageOrderValue: orders.length ? grossMerchandiseValue.div(orders.length).toFixed(2) : '0',
      totalDiscounts: totalDiscounts.toString(), couponOrders: orders.filter((order) => order.discount.greaterThan(0)).length,
      repeatCustomerRate: repeatCustomerRate.toFixed(1),
    },
    chart, topSellers, categorySales, recentUsers,
  });
}));

const adminOrderInclude = {
  user: { select: { id: true, displayName: true, username: true, email: true } },
  items: { orderBy: { createdAt: 'asc' as const } },
} as const;

adminRouter.get('/admin/orders', asyncHandler(async (req, res) => {
  const query = z.object({
    search: z.string().trim().max(100).optional(), status: z.enum(OrderStatus).optional(),
    page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(50).default(20),
  }).parse(req.query);
  const where: Prisma.OrderWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.search && { OR: [
      { orderNumber: { contains: query.search, mode: 'insensitive' } },
      { shippingName: { contains: query.search, mode: 'insensitive' } },
      { shippingPhone: { contains: query.search, mode: 'insensitive' } },
      { user: { displayName: { contains: query.search, mode: 'insensitive' } } },
      { user: { email: { contains: query.search, mode: 'insensitive' } } },
    ] }),
  };
  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit, include: adminOrderInclude }),
    prisma.order.count({ where }),
  ]);
  res.json({ orders, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
}));

const allowedOrderTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  DELIVERED: [],
  CANCELLED: [],
};

adminRouter.patch('/admin/orders/:orderNumber/status', asyncHandler(async (req, res) => {
  const orderNumber = z.string().trim().min(1).parse(req.params.orderNumber);
  const { status } = z.object({ status: z.enum(OrderStatus) }).parse(req.body);
  const order = await prisma.$transaction(async (tx) => {
    const found = await tx.order.findUnique({ where: { orderNumber }, include: adminOrderInclude });
    if (!found) throw new AppError(404, 'Order not found');
    if (found.status === status) return found;
    if (!allowedOrderTransitions[found.status].includes(status)) {
      throw new AppError(409, `Order cannot move from ${found.status.toLowerCase()} to ${status.toLowerCase()}`);
    }
    const updated = await tx.order.updateMany({ where: { id: found.id, status: found.status }, data: { status } });
    if (!updated.count) throw new AppError(409, 'The order status changed. Refresh and try again');
    if (status === OrderStatus.CANCELLED) {
      for (const item of found.items) {
        if (item.productId) await tx.product.updateMany({ where: { id: item.productId }, data: { inventory: { increment: item.quantity } } });
      }
      const usage = await tx.couponUsage.findUnique({ where: { orderId: found.id } });
      if (usage) {
        await tx.couponUsage.delete({ where: { id: usage.id } });
        await tx.coupon.update({ where: { id: usage.couponId }, data: { usedCount: { decrement: 1 } } });
      }
    }
    await tx.notification.create({ data: {
      userId: found.userId, type: NotificationType.ORDER,
      title: status === OrderStatus.CANCELLED ? 'Order cancelled' : 'Order status updated',
      message: `${found.orderNumber} is now ${status.toLowerCase()}.`, link: '/orders',
    } });
    return tx.order.findUniqueOrThrow({ where: { id: found.id }, include: adminOrderInclude });
  });
  res.json({ order });
}));

const couponSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()),
  type: z.enum(CouponType),
  value: z.coerce.number().positive().max(99_999_999),
  minOrderAmount: z.coerce.number().min(0).max(99_999_999).default(0),
  maxDiscount: z.union([z.coerce.number().positive().max(99_999_999), z.null()]).optional(),
  usageLimit: z.union([z.coerce.number().int().positive().max(1_000_000), z.null()]).optional(),
  startsAt: z.coerce.date().optional(), expiresAt: z.coerce.date().nullable().optional(), active: z.boolean().default(true),
}).refine((value) => value.type !== CouponType.PERCENTAGE || value.value <= 100, { message: 'Percentage coupons cannot exceed 100%', path: ['value'] })
  .refine((value) => !value.expiresAt || !value.startsAt || value.expiresAt > value.startsAt, { message: 'Expiry must be after the start date', path: ['expiresAt'] });

adminRouter.get('/admin/coupons', asyncHandler(async (_req, res) => {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { usages: true, orders: true } } } });
  res.json({ coupons });
}));

adminRouter.post('/admin/coupons', asyncHandler(async (req, res) => {
  const data = couponSchema.parse(req.body);
  const coupon = await prisma.coupon.create({ data: {
    code: data.code,
    type: data.type,
    value: data.value,
    minOrderAmount: data.minOrderAmount,
    maxDiscount: data.maxDiscount ?? null,
    usageLimit: data.usageLimit ?? null,
    startsAt: data.startsAt,
    expiresAt: data.expiresAt ?? null,
    active: data.active,
  } });
  res.status(201).json({ coupon });
}));

adminRouter.patch('/admin/coupons/:id', asyncHandler(async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const data = z.object({ active: z.boolean() }).strict().parse(req.body);
  const coupon = await prisma.coupon.update({ where: { id }, data });
  res.json({ coupon });
}));

adminRouter.delete('/admin/coupons/:id', asyncHandler(async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const coupon = await prisma.coupon.findUnique({ where: { id }, select: { id: true } });
  if (!coupon) throw new AppError(404, 'Coupon not found');
  await prisma.coupon.delete({ where: { id } });
  res.status(204).send();
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

adminRouter.patch('/admin/products/:id/inventory', asyncHandler(async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const { inventory } = z.object({ inventory: z.coerce.number().int().min(0).max(1_000_000) }).parse(req.body);
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError(404, 'Product not found');
  const product = await prisma.product.update({
    where: { id }, data: { inventory },
    include: { category: true, seller: { select: { id: true, username: true, displayName: true, avatarUrl: true } }, _count: { select: { orderItems: true } } },
  });
  res.json({ product });
}));
