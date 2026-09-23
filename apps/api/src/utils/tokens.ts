import { createHash, randomUUID } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

type AccessPayload = { sub: string; role: string };
type RefreshPayload = { sub: string; type: 'refresh'; jti: string };

export const signAccessToken = (payload: AccessPayload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'] });

// The random jti keeps tokens unique: without it, two issued to one user in the same second are
// byte-identical and collide on the unique tokenHash column.
export const signRefreshToken = (userId: string) =>
  jwt.sign({ sub: userId, type: 'refresh', jti: randomUUID() } satisfies RefreshPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
  });

export const verifyAccessToken = (token: string) => jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
export const verifyRefreshToken = (token: string) => jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

