import type { Options, Store } from 'express-rate-limit';
import { prisma } from './prisma.js';

// express-rate-limit keeps counters in process memory by default, which on Vercel means every
// function instance has its own budget. This store keeps them in Postgres so limits hold globally.
export class PostgresRateLimitStore implements Store {
  localKeys = false;
  private windowMs = 60_000;

  constructor(public prefix: string) {}

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  private key(key: string) {
    return `${this.prefix}:${key}`;
  }

  async increment(key: string) {
    const resetAt = new Date(Date.now() + this.windowMs);
    const [row] = await prisma.$queryRaw<{ hits: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "hits", "resetAt") VALUES (${this.key(key)}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN "RateLimit"."resetAt" <= NOW() THEN 1 ELSE "RateLimit"."hits" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= NOW() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "hits", "resetAt"`;
    // Occasionally sweep expired windows so the table stays small.
    if (Math.random() < 0.01) prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } }).catch(() => undefined);
    if (!row) throw new Error('Rate limit counter was not returned');
    return { totalHits: row.hits, resetTime: row.resetAt };
  }

  async decrement(key: string) {
    await prisma.rateLimit.updateMany({ where: { key: this.key(key), hits: { gt: 0 } }, data: { hits: { decrement: 1 } } });
  }

  async resetKey(key: string) {
    await prisma.rateLimit.deleteMany({ where: { key: this.key(key) } });
  }
}
