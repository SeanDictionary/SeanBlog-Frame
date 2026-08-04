import { Prisma } from '@prisma/client'

export function isDatabaseError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) return true
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code.startsWith('P10')) return true
  if (error instanceof Prisma.PrismaClientUnknownRequestError) return true
  if (error instanceof Error) {
    return /database|prisma|connection|ECONNREFUSED|Can't reach database|DATABASE_URL/i.test(error.message)
  }

  return false
}

export function getDatabaseErrorCode(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) return 'DATABASE_INITIALIZATION_FAILED'
  if (error instanceof Prisma.PrismaClientKnownRequestError) return `DATABASE_${error.code}`
  return 'DATABASE_UNAVAILABLE'
}
