import { PrismaClient } from '@prisma/client';

// Single Prisma client instance for the whole app
export const prisma = new PrismaClient();
