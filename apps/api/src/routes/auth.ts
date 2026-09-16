import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens.js';

export const authRouter = Router();
const safeUser = { id: true, email: true, username: true, displayName: true, avatarUrl: true, bio: true, role: true, status: true, createdAt: true } as const;
const cookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
  path: '/api/auth',
});

async function issueSession(user: { id: string; role: string }, res: Parameters<import('express').RequestHandler>[1]) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken(user.id);
  await prisma.refreshToken.create({ data: {
    tokenHash: hashToken(refreshToken), userId: user.id,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
  }});
  res.cookie('refreshToken', refreshToken, cookieOptions());
  return accessToken;
}

authRouter.post('/register', asyncHandler(async (req, res) => {
  const data = z.object({
    email: z.email().transform((value) => value.toLowerCase()),
    username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).transform((value) => value.toLowerCase()),
    displayName: z.string().min(2).max(60),
    password: z.string().min(8).max(72),
  }).parse(req.body);
  const existing = await prisma.user.findFirst({ where: { OR: [{ email: data.email }, { username: data.username }] } });
  if (existing) throw new AppError(409, 'Email or username is already in use');
  const { password, ...profile } = data;
  const user = await prisma.user.create({
    data: {
      email: profile.email,
      username: profile.username,
      displayName: profile.displayName,
      passwordHash: await bcrypt.hash(password, 12),
    },
    select: safeUser,
  });
  const accessToken = await issueSession(user, res);
  res.status(201).json({ user, accessToken });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const data = z.object({ email: z.email().transform((v) => v.toLowerCase()), password: z.string().min(1) }).parse(req.body);
  const found = await prisma.user.findUnique({ where: { email: data.email } });
  if (!found || !(await bcrypt.compare(data.password, found.passwordHash))) throw new AppError(401, 'Invalid email or password');
  if (found.status === 'SUSPENDED') throw new AppError(403, 'This account has been suspended');
  const user = await prisma.user.findUniqueOrThrow({ where: { id: found.id }, select: safeUser });
  const accessToken = await issueSession(user, res);
  res.json({ user, accessToken });
}));

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken as string | undefined;
  if (!token) throw new AppError(401, 'Refresh token required');
  let payload: ReturnType<typeof verifyRefreshToken>;
  try { payload = verifyRefreshToken(token); } catch { throw new AppError(401, 'Invalid refresh token'); }
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== payload.sub || stored.user.status === 'SUSPENDED') {
    throw new AppError(401, 'Refresh token is no longer valid');
  }
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  const accessToken = await issueSession(stored.user, res);
  res.json({ accessToken });
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken as string | undefined;
  if (token) await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  res.clearCookie('refreshToken', { ...cookieOptions(), maxAge: undefined });
  res.status(204).send();
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: safeUser });
  if (!user) throw new AppError(404, 'User not found');
  res.json({ user });
}));
