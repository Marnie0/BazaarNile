import { CouponType, NotificationType, OrderStatus, Prisma, ProductStatus, Role, UserStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { restoreStock } from '../lib/stock.js';
import { requireAdmin } from '../middleware/admin.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

export const adminRouter = Router();
// Products at or below this many units are flagged as running low in the admin panel.
const LOW_STOCK_THRESHOLD = 5;
adminRouter.use('/admin', requireAuth, requireAdmin);

const safeUser = {
  id: true, email: true, username: true, displayName: true, avatarUrl: true,
  role: true, status: true, createdAt: true, updatedAt: true,
  _count: { select: { products: true, orders: true } },
} as const;

// Every figure is computed in the database; nothing here loads the full order history into memory.
adminRouter.get('/admin/overview', asyncHandler(async (_req, res) => {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 13);
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const live = { status: { not: OrderStatus.CANCELLED } } satisfies Prisma.OrderWhereInput;

  const [totalUsers, newUsers, sellers, suspendedUsers, totalProducts, activeProducts, pendingProducts, totalOrders, openOrders, recentUsers,
    lowStockProducts, outOfStockProducts, orderTotals, couponOrders, windowOrders, [customers], sellerSales, categorySales] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.user.count({ where: { role: Role.SELLER } }),
    prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
    prisma.product.count(),
    prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
    prisma.product.count({ where: { status: ProductStatus.PENDING } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] } } }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 6, select: safeUser }),
    prisma.product.count({ where: { status: ProductStatus.ACTIVE, inventory: { gt: 0, lte: LOW_STOCK_THRESHOLD } } }),
    prisma.product.count({ where: { status: ProductStatus.ACTIVE, inventory: 0 } }),
    prisma.order.aggregate({ where: live, _sum: { subtotal: true, discount: true }, _count: { _all: true } }),
    prisma.order.count({ where: { ...live, discount: { gt: 0 } } }),
    prisma.order.findMany({ where: { ...live, createdAt: { gte: since } }, select: { subtotal: true, createdAt: true } }),
    prisma.$queryRaw<{ customers: bigint; repeat: bigint }[]>`
      SELECT COUNT(*) AS "customers", COUNT(*) FILTER (WHERE "orders" > 1) AS "repeat"
      FROM (SELECT COUNT(*) AS "orders" FROM "Order" WHERE "status" <> 'CANCELLED' GROUP BY "userId") AS per_customer`,
    prisma.$queryRaw<{ sellerId: string; revenue: Prisma.Decimal; orders: bigint }[]>`
      SELECT oi."sellerId", SUM(oi."lineTotal") AS "revenue", COUNT(DISTINCT oi."orderId") AS "orders"
      FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."status" <> 'CANCELLED' GROUP BY oi."sellerId" ORDER BY "revenue" DESC LIMIT 5`,
    prisma.$queryRaw<{ name: string; revenue: Prisma.Decimal; units: bigint }[]>`
      SELECT COALESCE(c."name", 'Archived products') AS "name", SUM(oi."lineTotal") AS "revenue", SUM(oi."quantity") AS "units"
      FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      LEFT JOIN "Product" p ON p."id" = oi."productId" LEFT JOIN "Category" c ON c."id" = p."categoryId"
      WHERE o."status" <> 'CANCELLED' GROUP BY 1 ORDER BY "revenue" DESC LIMIT 5`,
  ]);

  const grossMerchandiseValue = orderTotals._sum.subtotal ?? new Prisma.Decimal(0);
  const liveOrders = orderTotals._count._all;
  const customerCount = Number(customers?.customers ?? 0);
  const repeatCustomerRate = customerCount ? Number(customers?.repeat ?? 0) / customerCount * 100 : 0;
  const chart = Array.from({ length: 14 }, (_, offset) => {
    const day = new Date(since);
    day.setDate(since.getDate() + offset);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const daily = windowOrders.filter((order) => order.createdAt >= day && order.createdAt < next);
    return {
      date: day.toISOString().slice(0, 10),
      revenue: daily.reduce((sum, order) => sum.plus(order.subtotal), new Prisma.Decimal(0)).toString(),
      orders: daily.length,
    };
  });
  const sellerProfiles = await prisma.user.findMany({ where: { id: { in: sellerSales.map((row) => row.sellerId) } }, select: { id: true, displayName: true, username: true, avatarUrl: true } });
  const profileMap = new Map(sellerProfiles.map((profile) => [profile.id, profile]));
  const topSellers = sellerSales.map((row) => ({ ...profileMap.get(row.sellerId), revenue: row.revenue.toString(), orders: Number(row.orders) }));

  res.json({
    metrics: {
      totalUsers, newUsers, sellers, suspendedUsers, totalProducts, activeProducts, pendingProducts,
      lowStockProducts, outOfStockProducts,
      totalOrders, openOrders, grossMerchandiseValue: grossMerchandiseValue.toString(),
      averageOrderValue: liveOrders ? grossMerchandiseValue.div(liveOrders).toFixed(2) : '0',
      totalDiscounts: (orderTotals._sum.discount ?? new Prisma.Decimal(0)).toString(), couponOrders,
      repeatCustomerRate: repeatCustomerRate.toFixed(1),
    },
    chart, topSellers,
    categorySales: categorySales.map((row) => ({ name: row.name, revenue: row.revenue.toString(), units: Number(row.units) })),
    recentUsers,
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
      await restoreStock(tx, found.items);
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

const adminProductInclude = {
  category: { select: { id: true, name: true, slug: true } },
  seller: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  _count: { select: { orderItems: true } },
  variants: { orderBy: { position: 'asc' as const }, select: { id: true, options: true, inventory: true } },
} as const;

adminRouter.get('/admin/products', asyncHandler(async (req, res) => {
  const query = z.object({
    search: z.string().trim().max(100).optional(), status: z.enum(ProductStatus).optional(),
    stock: z.enum(['out', 'low', 'in']).optional(), sort: z.enum(['updated', 'stock-asc', 'stock-desc', 'name']).default('updated'),
    page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(50).default(20),
  }).parse(req.query);
  const stockFilter = { out: { equals: 0 }, low: { gt: 0, lte: LOW_STOCK_THRESHOLD }, in: { gt: LOW_STOCK_THRESHOLD } } as const;
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = {
    updated: [{ updatedAt: 'desc' as const }], name: [{ name: 'asc' as const }],
    'stock-asc': [{ inventory: 'asc' as const }, { name: 'asc' as const }], 'stock-desc': [{ inventory: 'desc' as const }, { name: 'asc' as const }],
  }[query.sort];
  const where: Prisma.ProductWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.stock && { inventory: stockFilter[query.stock] }),
    ...(query.search && { OR: [
      { name: { contains: query.search, mode: 'insensitive' } },
      { seller: { displayName: { contains: query.search, mode: 'insensitive' } } },
    ] }),
  };
  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({ where, orderBy, skip: (query.page - 1) * query.limit, take: query.limit, include: adminProductInclude }),
    prisma.product.count({ where }),
  ]);
  res.json({ products, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
}));

// Stock health across every listing that is not archived.
adminRouter.get('/admin/inventory/summary', asyncHandler(async (_req, res) => {
  const [row] = await prisma.$queryRaw<{ products: bigint; units: bigint | null; value: Prisma.Decimal | null; out: bigint; low: bigint }[]>`
    SELECT COUNT(*) AS "products", SUM("inventory") AS "units", SUM("inventory" * "price") AS "value",
      COUNT(*) FILTER (WHERE "inventory" = 0) AS "out",
      COUNT(*) FILTER (WHERE "inventory" > 0 AND "inventory" <= ${LOW_STOCK_THRESHOLD}) AS "low"
    FROM "Product" WHERE "status" <> 'ARCHIVED'`;
  const products = Number(row?.products ?? 0); const out = Number(row?.out ?? 0); const low = Number(row?.low ?? 0);
  res.json({ summary: {
    products, unitsInStock: Number(row?.units ?? 0), stockValue: (row?.value ?? new Prisma.Decimal(0)).toString(),
    outOfStock: out, lowStock: low, healthy: products - out - low, lowStockThreshold: LOW_STOCK_THRESHOLD,
  } });
}));

adminRouter.patch('/admin/products/:id/moderate', asyncHandler(async (req, res) => {
  const id = z.string().parse(req.params.id);
  const { status } = z.object({ status: z.enum([ProductStatus.ACTIVE, ProductStatus.REJECTED, ProductStatus.ARCHIVED]) }).parse(req.body);
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError(404, 'Product not found');
  const product = await prisma.product.update({
    where: { id }, data: { status },
    include: adminProductInclude,
  });
  res.json({ product });
}));

adminRouter.patch('/admin/products/:id/inventory', asyncHandler(async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const { inventory } = z.object({ inventory: z.coerce.number().int().min(0).max(1_000_000) }).parse(req.body);
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true, optionNames: true } });
  if (!existing) throw new AppError(404, 'Product not found');
  if (existing.optionNames.length) throw new AppError(409, 'This listing tracks stock per option. Update each option instead');
  const product = await prisma.product.update({
    where: { id }, data: { inventory },
    include: adminProductInclude,
  });
  res.json({ product });
}));

// Per-option stock for listings with sizes or colors; the listing total follows the sum.
adminRouter.patch('/admin/products/:id/variants/:variantId/inventory', asyncHandler(async (req, res) => {
  const id = z.string().min(1).parse(req.params.id); const variantId = z.string().min(1).parse(req.params.variantId);
  const { inventory } = z.object({ inventory: z.coerce.number().int().min(0).max(1_000_000) }).parse(req.body);
  const product = await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findFirst({ where: { id: variantId, productId: id }, select: { id: true } });
    if (!variant) throw new AppError(404, 'Option not found');
    await tx.productVariant.update({ where: { id: variantId }, data: { inventory } });
    const total = await tx.productVariant.aggregate({ where: { productId: id }, _sum: { inventory: true } });
    return tx.product.update({ where: { id }, data: { inventory: total._sum.inventory ?? 0 }, include: adminProductInclude });
  });
  res.json({ product });
}));
