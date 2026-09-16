import { ProductStatus } from '@prisma/client';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { generateSummary } from '../services/gemini.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

export const aiRouter = Router();
aiRouter.use('/ai', requireAuth, rateLimit({
  windowMs: 10 * 60_000, limit: 12, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many AI summary requests. Please try again shortly' },
}));

aiRouter.post('/ai/products/:productId/summary', asyncHandler(async (req, res) => {
  const productId = z.string().min(1).parse(req.params.productId);
  const product = await prisma.product.findFirst({
    where: { id: productId, status: ProductStatus.ACTIVE },
    include: { category: { select: { name: true } }, seller: { select: { displayName: true } } },
  });
  if (!product) throw new AppError(404, 'Product not found');
  const summary = await generateSummary(`Summarize this product for a shopper in 2 or 3 useful sentences. Explain what it is, its main benefits, price, and availability. Avoid hype.\n\nPRODUCT DATA:\n${JSON.stringify({
    name: product.name, category: product.category.name, description: product.description,
    priceEGP: product.price.toString(), compareAtEGP: product.compareAt?.toString() ?? null,
    inventory: product.inventory, seller: product.seller.displayName,
  })}`);
  res.json({ summary });
}));

aiRouter.post('/ai/cart/summary', asyncHandler(async (req, res) => {
  const cart = await prisma.cart.findUnique({
    where: { userId: req.user!.id },
    include: { items: { include: { product: { include: { category: { select: { name: true } } } } } } },
  });
  if (!cart?.items.length) throw new AppError(400, 'Your cart is empty');
  const subtotal = cart.items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const shipping = subtotal >= 1_500 ? 0 : 75;
  const summary = await generateSummary(`Summarize this shopping cart in 3 or 4 concise sentences. Describe the selection, quantities, total cost in Egyptian pounds, shipping cost, and flag any unavailable or insufficient-stock item. Give one practical observation without inventing product compatibility or benefits.\n\nCART DATA:\n${JSON.stringify({
    items: cart.items.map((item) => ({ name: item.product.name, category: item.product.category.name,
      quantity: item.quantity, unitPriceEGP: item.product.price.toString(), inventory: item.product.inventory,
      available: item.product.status === ProductStatus.ACTIVE })),
    subtotalEGP: subtotal, shippingEGP: shipping, totalEGP: subtotal + shipping,
  })}`);
  res.json({ summary });
}));
