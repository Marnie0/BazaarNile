import type { RequestHandler } from 'express';
import { AppError } from '../utils/errors.js';

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== 'ADMIN') return next(new AppError(403, 'Administrator access required'));
  next();
};
