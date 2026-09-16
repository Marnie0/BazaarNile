import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, _res, next) => next(new AppError(404, 'Route not found'));

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ message: 'Invalid request', issues: error.issues });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({ message: 'A record with these details already exists' });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ message: 'The requested record no longer exists' });
      return;
    }
    if (error.code === 'P2034') {
      res.status(409).json({ message: 'This request conflicted with another update. Please try again' });
      return;
    }
  }
  console.error(error);
  res.status(500).json({ message: 'Something went wrong' });
};
