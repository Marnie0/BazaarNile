import { randomBytes } from 'node:crypto';
import { OrderStatus, Prisma, ProductStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

export const shoppingRouter = Router();
shoppingRouter.use(['/cart', '/wishlist', '/checkout', '/orders'], requireAuth);

const productInclude = {
  category: { select: { name: true, slug: true } },
  seller: { select: { username: true, displayName: true, avatarUrl: true } },
} as const;

const cartInclude = {
  items: { orderBy: { createdAt: 'asc' as const }, include: { product: { include: productInclude } } },
} as const;

shoppingRouter.get('/cart', asyncHandler(async (req, res) => {
  const cart = await prisma.cart.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id },
    update: {},
    include: cartInclude,
  });
  res.json({ cart });
}));

shoppingRouter.post('/cart/items', asyncHandler(async (req, res) => {
  const data = z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(20).default(1) }).parse(req.body);
  const product = await prisma.product.findFirst({ where: { id: data.productId, status: ProductStatus.ACTIVE } });
  if (!product) throw new AppError(404, 'Product not found');
  if (product.inventory < data.quantity) throw new AppError(409, 'Not enough inventory available');
  const cart = await prisma.cart.upsert({ where: { userId: req.user!.id }, create: { userId: req.user!.id }, update: {} });
  const existing = await prisma.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId: product.id } } });
  const quantity = Math.min((existing?.quantity ?? 0) + data.quantity, 20);
  if (quantity > product.inventory) throw new AppError(409, 'Not enough inventory available');
  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId: product.id } },
    create: { cartId: cart.id, productId: product.id, quantity: data.quantity },
    update: { quantity },
  });
  const result = await prisma.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude });
  res.status(201).json({ cart: result });
}));

shoppingRouter.patch('/cart/items/:itemId', asyncHandler(async (req, res) => {
  const itemId = z.string().parse(req.params.itemId);
  const { quantity } = z.object({ quantity: z.number().int().min(1).max(20) }).parse(req.body);
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId: req.user!.id } }, include: { product: true } });
  if (!item) throw new AppError(404, 'Cart item not found');
  if (quantity > item.product.inventory) throw new AppError(409, 'Not enough inventory available');
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  const cart = await prisma.cart.findUniqueOrThrow({ where: { id: item.cartId }, include: cartInclude });
  res.json({ cart });
}));

shoppingRouter.delete('/cart/items/:itemId', asyncHandler(async (req, res) => {
  const itemId = z.string().parse(req.params.itemId);
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId: req.user!.id } } });
  if (!item) throw new AppError(404, 'Cart item not found');
  await prisma.cartItem.delete({ where: { id: item.id } });
  res.status(204).send();
}));

shoppingRouter.get('/wishlist', asyncHandler(async (req, res) => {
  const items = await prisma.wishlistItem.findMany({
    where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' },
    include: { product: { include: productInclude } },
  });
  res.json({ items });
}));

shoppingRouter.post('/wishlist/:productId', asyncHandler(async (req, res) => {
  const productId = z.string().parse(req.params.productId);
  const product = await prisma.product.findFirst({ where: { id: productId, status: ProductStatus.ACTIVE } });
  if (!product) throw new AppError(404, 'Product not found');
  const item = await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId: req.user!.id, productId } },
    create: { userId: req.user!.id, productId }, update: {},
    include: { product: { include: productInclude } },
  });
  res.status(201).json({ item });
}));

shoppingRouter.delete('/wishlist/:productId', asyncHandler(async (req, res) => {
  const productId = z.string().parse(req.params.productId);
  await prisma.wishlistItem.deleteMany({ where: { userId: req.user!.id, productId } });
  res.status(204).send();
}));

const checkoutSchema = z.object({
  shippingName: z.string().trim().min(2).max(80),
  shippingPhone: z.string().trim().min(8).max(20),
  shippingAddress: z.string().trim().min(8).max(200),
  shippingCity: z.string().trim().min(2).max(80),
  shippingRegion: z.string().trim().min(2).max(80),
  notes: z.string().trim().max(500).optional(),
});

shoppingRouter.post('/checkout', asyncHandler(async (req, res) => {
  const shipping = checkoutSchema.parse(req.body);
  const order = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId: req.user!.id },
      include: { items: { include: { product: true } } },
    });
    if (!cart?.items.length) throw new AppError(400, 'Your cart is empty');
    for (const item of cart.items) {
      if (item.product.status !== ProductStatus.ACTIVE) throw new AppError(409, `${item.product.name} is no longer available`);
      const updated = await tx.product.updateMany({
        where: { id: item.productId, inventory: { gte: item.quantity } },
        data: { inventory: { decrement: item.quantity } },
      });
      if (!updated.count) throw new AppError(409, `Not enough inventory for ${item.product.name}`);
    }
    const subtotal = cart.items.reduce((sum, item) => sum.plus(item.product.price.mul(item.quantity)), new Prisma.Decimal(0));
    const shippingFee = subtotal.greaterThanOrEqualTo(1500) ? new Prisma.Decimal(0) : new Prisma.Decimal(75);
    const created = await tx.order.create({
      data: {
        orderNumber: `BN-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`,
        userId: req.user!.id, ...shipping, subtotal, shippingFee, total: subtotal.plus(shippingFee),
        items: { create: cart.items.map((item) => ({
          productId: item.productId, sellerId: item.product.sellerId, productName: item.product.name,
          productSlug: item.product.slug, imageUrl: item.product.imageUrl, unitPrice: item.product.price,
          quantity: item.quantity, lineTotal: item.product.price.mul(item.quantity),
        })) },
      },
      include: { items: true },
    });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.status(201).json({ order });
}));

shoppingRouter.get('/orders', asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, include: { items: true },
  });
  res.json({ orders });
}));

shoppingRouter.get('/orders/:orderNumber', asyncHandler(async (req, res) => {
  const orderNumber = z.string().parse(req.params.orderNumber);
  const order = await prisma.order.findFirst({ where: { orderNumber, userId: req.user!.id }, include: { items: true } });
  if (!order) throw new AppError(404, 'Order not found');
  res.json({ order });
}));

shoppingRouter.patch('/orders/:orderNumber/cancel', asyncHandler(async (req, res) => {
  const orderNumber = z.string().parse(req.params.orderNumber);
  const order = await prisma.$transaction(async (tx) => {
    const found = await tx.order.findFirst({ where: { orderNumber, userId: req.user!.id }, include: { items: true } });
    if (!found) throw new AppError(404, 'Order not found');
    if (found.status !== OrderStatus.PENDING && found.status !== OrderStatus.CONFIRMED) {
      throw new AppError(409, 'This order can no longer be cancelled');
    }
    const cancelled = await tx.order.updateMany({
      where: { id: found.id, status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] } },
      data: { status: OrderStatus.CANCELLED },
    });
    if (!cancelled.count) throw new AppError(409, 'This order can no longer be cancelled');
    for (const item of found.items) {
      if (item.productId) await tx.product.update({ where: { id: item.productId }, data: { inventory: { increment: item.quantity } } });
    }
    return tx.order.findUniqueOrThrow({ where: { id: found.id }, include: { items: true } });
  });
  res.json({ order });
}));
