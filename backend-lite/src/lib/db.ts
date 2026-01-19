import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function createDatabase() {
  return prisma;
}

export { prisma };
