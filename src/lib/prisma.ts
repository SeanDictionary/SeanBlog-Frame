import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { isDatabaseError } from '@/lib/database-errors'
import { env } from '@/lib/env'

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })
}

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }

  return globalForPrisma.prisma
}

/**
 * Lightweight reachability probe used by always-on flows (e.g. login) to fail
 * gracefully when the database is down instead of surfacing a misleading
 * error. Returns false only on database connectivity failures; unexpected
 * errors are rethrown so they are not masked.
 */
export async function isDatabaseAvailable() {
  try {
    await getPrisma().$queryRaw`SELECT 1`
    return true
  } catch (error) {
    if (isDatabaseError(error)) {
      return false
    }
    throw error
  }
}
