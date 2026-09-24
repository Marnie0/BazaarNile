import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

export const accountRouter = Router();
accountRouter.use('/account', requireAuth);

const MAX_ADDRESSES = 10;
const addressFields = z.object({
  label: z.string().trim().min(1, 'Give this address a name, like Home').max(30, 'Keep the name under 30 characters'),
  fullName: z.string().trim().min(2, 'Full name must contain at least 2 characters').max(80, 'Full name is too long'),
  phone: z.string().trim().min(8, 'Phone number must contain at least 8 characters').max(20, 'Phone number is too long'),
  street: z.string().trim().min(3, 'Street address must contain at least 3 characters').max(200, 'Street address is too long'),
  city: z.string().trim().min(2, 'City must contain at least 2 characters').max(80, 'City is too long'),
  region: z.string().trim().min(2, 'Governorate must contain at least 2 characters').max(80, 'Governorate is too long'),
  notes: z.string().trim().max(500, 'Delivery notes cannot exceed 500 characters').nullable().optional().transform((value) => value === undefined ? undefined : value || null),
  isDefault: z.boolean().optional(),
});
const byDefaultThenRecent = [{ isDefault: 'desc' as const }, { updatedAt: 'desc' as const }];

accountRouter.get('/account/addresses', asyncHandler(async (req, res) => {
  res.json({ addresses: await prisma.address.findMany({ where: { userId: req.user!.id }, orderBy: byDefaultThenRecent }) });
}));

accountRouter.post('/account/addresses', asyncHandler(async (req, res) => {
  const data = addressFields.parse(req.body); const userId = req.user!.id;
  const address = await prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) throw new AppError(409, `You can save up to ${MAX_ADDRESSES} addresses. Remove one to add another`);
    // The first address becomes the default automatically.
    const isDefault = data.isDefault || count === 0;
    if (isDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.create({ data: { ...data, isDefault, userId } });
  });
  res.status(201).json({ address });
}));

accountRouter.patch('/account/addresses/:id', asyncHandler(async (req, res) => {
  const id = z.string().min(1).max(40).parse(req.params.id); const userId = req.user!.id;
  const data = addressFields.partial().parse(req.body);
  const address = await prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'Address not found');
    if (data.isDefault === false && existing.isDefault) delete data.isDefault; // Choose another default instead of leaving none.
    if (data.isDefault) await tx.address.updateMany({ where: { userId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    return tx.address.update({ where: { id }, data });
  });
  res.json({ address });
}));

accountRouter.delete('/account/addresses/:id', asyncHandler(async (req, res) => {
  const id = z.string().min(1).max(40).parse(req.params.id); const userId = req.user!.id;
  await prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'Address not found');
    await tx.address.delete({ where: { id } });
    if (existing.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' }, select: { id: true } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  res.status(204).send();
}));
