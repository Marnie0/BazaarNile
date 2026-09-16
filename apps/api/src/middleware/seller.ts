import type { RequestHandler } from 'express';
import { AppError } from '../utils/errors.js';

export const requireSeller: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== 'SELLER' && req.user?.role !== 'ADMIN') {
    return next(new AppError(403, 'Seller access required'));
  }
  next();
};

