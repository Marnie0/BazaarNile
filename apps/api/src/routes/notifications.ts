import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

export const notificationsRouter = Router();
notificationsRouter.use('/notifications', requireAuth);

notificationsRouter.get('/notifications', asyncHandler(async (req, res) => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(50).default(30) }).parse(req.query);
  const [notifications, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
  ]);
  res.json({ notifications, unreadCount });
}));

notificationsRouter.patch('/notifications/read-all', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
  res.status(204).send();
}));

notificationsRouter.patch('/notifications/:id/read', asyncHandler(async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const updated = await prisma.notification.updateMany({ where: { id, userId: req.user!.id }, data: { readAt: new Date() } });
  if (!updated.count) throw new AppError(404, 'Notification not found');
  res.status(204).send();
}));
