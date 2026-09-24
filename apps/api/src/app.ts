import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { reviewsRouter } from './routes/reviews.js';
import { accountRouter } from './routes/account.js';
import { shoppingRouter } from './routes/shopping.js';
import { sellerRouter } from './routes/seller.js';
import { adminRouter } from './routes/admin.js';
import { aiRouter } from './routes/ai.js';
import { notificationsRouter } from './routes/notifications.js';
import { errorHandler, notFound } from './utils/errors.js';

export const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.CLIENT_URL.split(',').map((url) => url.trim()), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
// In-memory burst guard per instance; the sensitive limiters in the routers use the shared store.
app.use('/api', rateLimit({
  windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down and try again shortly' },
}));
// Auth routes carry their own targeted limiters; a blanket cap here would also count the silent
// session refresh on every page load and lock out shoppers sharing a carrier-grade NAT address.
app.use('/api/auth', authRouter);
app.use('/api', catalogRouter);
app.use('/api', reviewsRouter);
app.use('/api', accountRouter);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', shoppingRouter);
app.use('/api', sellerRouter);
app.use('/api', adminRouter);
app.use('/api', aiRouter);
app.use('/api', notificationsRouter);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use(notFound);
app.use(errorHandler);
