import { randomBytes } from 'node:crypto';
import { CouponType, NotificationType, OrderStatus, Prisma, ProductStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { cartLineKey, restoreStock, variantLabel } from '../lib/stock.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

export const shoppingRouter = Router();
shoppingRouter.use(['/cart', '/wishlist', '/checkout', '/orders', '/coupons'], requireAuth);

const productInclude = {
  category: { select: { name: true, slug: true } },
  seller: { select: { username: true, displayName: true, avatarUrl: true } },
} as const;

const cartInclude = {
  items: { orderBy: { createdAt: 'asc' as const }, include: { product: { include: productInclude }, variant: { select: { id: true, options: true, inventory: true } } } },
} as const;

async function serializableTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt === 2) throw error;
    }
  }
  throw new AppError(409, 'The order changed while it was being processed. Please try again');
}

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
  const data = z.object({ productId: z.string().min(1), variantId: z.string().min(1).max(40).optional(), quantity: z.number().int().min(1).max(20).default(1) }).parse(req.body);
  const product = await prisma.product.findFirst({ where: { id: data.productId, status: ProductStatus.ACTIVE } });
  if (!product) throw new AppError(404, 'Product not found');
  let stock = product.inventory;
  if (product.optionNames.length) {
    if (!data.variantId) throw new AppError(400, `Choose a ${product.optionNames.join(' and ').toLowerCase()} first`);
    const variant = await prisma.productVariant.findFirst({ where: { id: data.variantId, productId: product.id } });
    if (!variant) throw new AppError(404, 'That option is no longer available');
    stock = variant.inventory;
  } else if (data.variantId) throw new AppError(400, 'This product has no options');
  const variantId = product.optionNames.length ? data.variantId! : null;
  if (stock < data.quantity) throw new AppError(409, 'Not enough inventory available');
  const cart = await prisma.cart.upsert({ where: { userId: req.user!.id }, create: { userId: req.user!.id }, update: {} });
  const lineKey = cartLineKey(product.id, variantId);
  const existing = await prisma.cartItem.findUnique({ where: { cartId_lineKey: { cartId: cart.id, lineKey } } });
  const quantity = Math.min((existing?.quantity ?? 0) + data.quantity, 20);
  if (quantity > stock) throw new AppError(409, 'Not enough inventory available');
  await prisma.cartItem.upsert({
    where: { cartId_lineKey: { cartId: cart.id, lineKey } },
    create: { cartId: cart.id, productId: product.id, variantId, lineKey, quantity: data.quantity },
    update: { quantity },
  });
  const result = await prisma.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude });
  res.status(201).json({ cart: result });
}));

shoppingRouter.patch('/cart/items/:itemId', asyncHandler(async (req, res) => {
  const itemId = z.string().parse(req.params.itemId);
  const { quantity } = z.object({ quantity: z.number().int().min(1).max(20) }).parse(req.body);
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId: req.user!.id } }, include: { product: true, variant: true } });
  if (!item) throw new AppError(404, 'Cart item not found');
  if (item.product.status !== ProductStatus.ACTIVE) throw new AppError(409, `${item.product.name} is no longer available`);
  if (quantity > (item.variant ? item.variant.inventory : item.product.inventory)) throw new AppError(409, 'Not enough inventory available');
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
    where: { userId: req.user!.id, product: { status: ProductStatus.ACTIVE } }, orderBy: { createdAt: 'desc' },
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
  shippingName: z.string().trim().min(2, 'Full name must contain at least 2 characters').max(80, 'Full name is too long'),
  shippingPhone: z.string().trim().min(8, 'Phone number must contain at least 8 characters').max(20, 'Phone number is too long'),
  shippingAddress: z.string().trim().min(3, 'Street address must contain at least 3 characters').max(200, 'Street address is too long'),
  shippingCity: z.string().trim().min(2, 'City must contain at least 2 characters').max(80, 'City is too long'),
  shippingRegion: z.string().trim().min(2, 'Governorate must contain at least 2 characters').max(80, 'Governorate is too long'),
  notes: z.string().trim().max(500, 'Delivery notes cannot exceed 500 characters').optional(),
  couponCode: z.string().trim().max(40).optional(),
});

async function resolveCoupon(tx: Prisma.TransactionClient, userId: string, rawCode: string, subtotal: Prisma.Decimal) {
  const code = rawCode.trim().toUpperCase();
  const coupon = await tx.coupon.findUnique({ where: { code } });
  const now = new Date();
  if (!coupon || !coupon.active || coupon.startsAt > now || (coupon.expiresAt && coupon.expiresAt <= now)) throw new AppError(400, 'This coupon is invalid or expired');
  if (subtotal.lessThan(coupon.minOrderAmount)) throw new AppError(400, `This coupon requires a minimum order of EGP ${coupon.minOrderAmount.toString()}`);
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) throw new AppError(409, 'This coupon has reached its usage limit');
  if (await tx.couponUsage.findUnique({ where: { couponId_userId: { couponId: coupon.id, userId } }, select: { id: true } })) throw new AppError(409, 'You have already used this coupon');
  let discount = coupon.type === CouponType.PERCENTAGE ? subtotal.mul(coupon.value).div(100) : coupon.value;
  if (coupon.maxDiscount && discount.greaterThan(coupon.maxDiscount)) discount = coupon.maxDiscount;
  if (discount.greaterThan(subtotal)) discount = subtotal;
  return { coupon, discount: discount.toDecimalPlaces(2) };
}

shoppingRouter.post('/coupons/validate', asyncHandler(async (req, res) => {
  const { code } = z.object({ code: z.string().trim().min(1).max(40) }).parse(req.body);
  const result = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({ where: { userId: req.user!.id }, include: { items: { include: { product: true } } } });
    if (!cart?.items.length) throw new AppError(400, 'Your cart is empty');
    const subtotal = cart.items.reduce((sum, item) => sum.plus(item.product.price.mul(item.quantity)), new Prisma.Decimal(0));
    const shippingFee = subtotal.greaterThanOrEqualTo(1500) ? new Prisma.Decimal(0) : new Prisma.Decimal(75);
    const { coupon, discount } = await resolveCoupon(tx, req.user!.id, code, subtotal);
    return { coupon: { code: coupon.code, type: coupon.type, value: coupon.value.toString() }, subtotal: subtotal.toString(), shippingFee: shippingFee.toString(), discount: discount.toString(), total: subtotal.plus(shippingFee).minus(discount).toString() };
  });
  res.json(result);
}));

shoppingRouter.post('/checkout', asyncHandler(async (req, res) => {
  const { couponCode, ...shipping } = checkoutSchema.parse(req.body);
  const order = await serializableTransaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId: req.user!.id },
      include: { items: { include: { product: true, variant: true } } },
    });
    if (!cart?.items.length) throw new AppError(400, 'Your cart is empty');
    for (const item of cart.items) {
      if (item.product.status !== ProductStatus.ACTIVE) throw new AppError(409, `${item.product.name} is no longer available`);
      if (item.product.optionNames.length && !item.variant) throw new AppError(409, `Choose an option for ${item.product.name} in your cart`);
      if (item.variant) {
        const label = item.variant.options.join(' / ');
        const taken = await tx.productVariant.updateMany({ where: { id: item.variant.id, inventory: { gte: item.quantity } }, data: { inventory: { decrement: item.quantity } } });
        if (!taken.count) throw new AppError(409, `Not enough inventory for ${item.product.name} (${label})`);
      }
      const updated = await tx.product.updateMany({
        where: { id: item.productId, status: ProductStatus.ACTIVE, inventory: { gte: item.quantity } },
        data: { inventory: { decrement: item.quantity } },
      });
      if (!updated.count) throw new AppError(409, `Not enough inventory for ${item.product.name}`);
    }
    const subtotal = cart.items.reduce((sum, item) => sum.plus(item.product.price.mul(item.quantity)), new Prisma.Decimal(0));
    const shippingFee = subtotal.greaterThanOrEqualTo(1500) ? new Prisma.Decimal(0) : new Prisma.Decimal(75);
    const couponResult = couponCode ? await resolveCoupon(tx, req.user!.id, couponCode, subtotal) : null;
    const discount = couponResult?.discount ?? new Prisma.Decimal(0);
    const created = await tx.order.create({
      data: {
        orderNumber: `BN-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`,
        userId: req.user!.id, ...shipping, subtotal, shippingFee, discount, total: subtotal.plus(shippingFee).minus(discount),
        ...(couponResult && { couponId: couponResult.coupon.id, couponCode: couponResult.coupon.code }),
        items: { create: cart.items.map((item) => ({
          productId: item.productId, sellerId: item.product.sellerId, productName: item.product.name,
          productSlug: item.product.slug, imageUrl: item.product.imageUrl, unitPrice: item.product.price,
          variantId: item.variant?.id ?? null, variantLabel: item.variant ? variantLabel(item.product.optionNames, item.variant.options) : null,
          quantity: item.quantity, lineTotal: item.product.price.mul(item.quantity),
        })) },
      },
      include: { items: true },
    });
    if (couponResult) {
      await tx.couponUsage.create({ data: { couponId: couponResult.coupon.id, userId: req.user!.id, orderId: created.id } });
      await tx.coupon.update({ where: { id: couponResult.coupon.id }, data: { usedCount: { increment: 1 } } });
    }
    const sellerIds = [...new Set(cart.items.map((item) => item.product.sellerId))];
    await tx.notification.createMany({ data: [
      { userId: req.user!.id, type: NotificationType.ORDER, title: 'Order placed', message: `${created.orderNumber} was placed successfully.`, link: '/orders' },
      ...sellerIds.map((sellerId) => ({ userId: sellerId, type: NotificationType.SELLER, title: 'New marketplace order', message: `${created.orderNumber} includes one or more of your products.`, link: '/seller' })),
    ] });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return created;
  });
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
    await restoreStock(tx, found.items);
    const usage = await tx.couponUsage.findUnique({ where: { orderId: found.id } });
    if (usage) {
      await tx.couponUsage.delete({ where: { id: usage.id } });
      await tx.coupon.update({ where: { id: usage.couponId }, data: { usedCount: { decrement: 1 } } });
    }
    const sellerIds = [...new Set(found.items.map((item) => item.sellerId))];
    await tx.notification.createMany({ data: sellerIds.map((sellerId) => ({ userId: sellerId, type: NotificationType.SELLER, title: 'Order cancelled', message: `${found.orderNumber} was cancelled and its inventory was restored.`, link: '/seller' })) });
    return tx.order.findUniqueOrThrow({ where: { id: found.id }, include: { items: true } });
  });
  res.json({ order });
}));
