import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const DEFAULT_OPERATION_LOG_RETENTION_DAYS = 365
const MAX_OPERATION_LOG_RETENTION_DAYS = 3650
const OPERATION_LOG_RETENTION_SETTING_KEY = 'operationLogRetentionDays'

function createPrisma() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.')
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })
}

function resolveRetentionDays(rawSetting) {
  const parsed = typeof rawSetting === 'number' ? rawSetting : Number(rawSetting)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_OPERATION_LOG_RETENTION_DAYS
  }

  return Math.min(MAX_OPERATION_LOG_RETENTION_DAYS, Math.round(parsed))
}

async function getRetentionDays(prisma) {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: OPERATION_LOG_RETENTION_SETTING_KEY },
    select: { value: true },
  })

  let parsed
  try {
    parsed = setting ? JSON.parse(setting.value) : null
  } catch {
    parsed = null
  }

  return resolveRetentionDays(parsed)
}

async function prune(prisma) {
  const retentionDays = await getRetentionDays(prisma)
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const result = await prisma.operationLog.deleteMany({ where: { createdAt: { lt: cutoff } } })

  return { retentionDays, cutoff, deletedCount: result.count }
}

const prisma = createPrisma()

prune(prisma)
  .then(({ retentionDays, cutoff, deletedCount }) => {
    if (deletedCount > 0) {
      console.log(`Pruned ${deletedCount} operation log(s) older than ${retentionDays} day(s) (before ${cutoff.toISOString()}).`)
    } else {
      console.log(`No operation logs older than ${retentionDays} day(s) to prune.`)
    }
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
