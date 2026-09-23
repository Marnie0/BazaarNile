import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

// Checkout and cancellations run several sequential queries inside one interactive transaction;
// Prisma's 5 s default is too tight when the database is a network hop away.
export const prisma = globalThis.prisma ?? new PrismaClient({ transactionOptions: { maxWait: 5_000, timeout: 15_000 } });
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
