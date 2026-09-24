import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';

/** "Size: M · Color: Black", the label stored on order lines and shown in carts. */
export const variantLabel = (optionNames: string[], options: string[]) =>
  optionNames.map((name, index) => `${name}: ${options[index] ?? ''}`).join(' · ');

export const cartLineKey = (productId: string, variantId?: string | null) => variantId ? `${productId}:${variantId}` : productId;

const optionName = z.string().trim().min(1).max(20);
const optionValue = z.string().trim().min(1).max(30);
export const optionsSchema = {
  optionNames: z.array(optionName).max(2).optional(),
  variants: z.array(z.object({
    id: z.string().min(1).optional(),
    options: z.array(optionValue).min(1).max(2),
    inventory: z.coerce.number().int().min(0).max(1_000_000),
  })).max(60).optional(),
};
export type VariantInput = { id?: string; options: string[]; inventory: number };

/** Validates that every variant has one value per option name and that no combination repeats. */
export function checkVariants(optionNames: string[], variants: VariantInput[]) {
  if (new Set(optionNames.map((name) => name.toLowerCase())).size !== optionNames.length) throw new AppError(400, 'Option names must be different');
  if (!optionNames.length) { if (variants.length) throw new AppError(400, 'Add an option name, such as Size, before adding options'); return; }
  if (!variants.length) throw new AppError(400, 'Add at least one option, or remove the option names');
  const seen = new Set<string>();
  for (const variant of variants) {
    if (variant.options.length !== optionNames.length) throw new AppError(400, `Each option needs a value for ${optionNames.join(' and ')}`);
    const key = variant.options.map((value) => value.toLowerCase()).join('\u0000');
    if (seen.has(key)) throw new AppError(400, `${variant.options.join(' / ')} is listed twice`);
    seen.add(key);
  }
}

/**
 * Replaces a product's variants, keeping ids that still exist so cart lines survive an edit,
 * and keeps Product.inventory equal to the sum of variant stock.
 */
export async function syncVariants(tx: Prisma.TransactionClient, productId: string, variants: VariantInput[]) {
  const existing = await tx.productVariant.findMany({ where: { productId }, select: { id: true } });
  const existingIds = new Set(existing.map((variant) => variant.id));
  const keep = new Set(variants.flatMap((variant) => variant.id && existingIds.has(variant.id) ? [variant.id] : []));
  await tx.productVariant.deleteMany({ where: { productId, id: { notIn: [...keep] } } });
  for (const [position, variant] of variants.entries()) {
    const data = { options: variant.options, inventory: variant.inventory, position };
    if (variant.id && keep.has(variant.id)) await tx.productVariant.update({ where: { id: variant.id }, data });
    else await tx.productVariant.create({ data: { ...data, productId } });
  }
  return variants.reduce((sum, variant) => sum + variant.inventory, 0);
}

/** Puts stock from cancelled order lines back on the shelf. */
export async function restoreStock(tx: Prisma.TransactionClient, items: { productId: string | null; variantId: string | null; quantity: number }[]) {
  for (const item of items) {
    if (!item.productId) continue;
    if (item.variantId) {
      const restored = await tx.productVariant.updateMany({ where: { id: item.variantId }, data: { inventory: { increment: item.quantity } } });
      if (restored.count) await tx.product.updateMany({ where: { id: item.productId }, data: { inventory: { increment: item.quantity } } });
    } else {
      // A listing that gained options since the order was placed tracks stock per option, so its total is left alone.
      await tx.product.updateMany({ where: { id: item.productId, optionNames: { isEmpty: true } }, data: { inventory: { increment: item.quantity } } });
    }
  }
}
