import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured.')
}

const adapter = new PrismaPg({ connectionString })

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
