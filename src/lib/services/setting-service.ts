import { notFound } from '@/lib/api/errors'
import { getPrisma } from '@/lib/prisma'

function serializeValue(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function deserializeValue(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

export async function listSettings() {
  const settings = await getPrisma().siteSetting.findMany({
    orderBy: { key: 'asc' },
  })

  return settings.map((setting) => ({
    ...setting,
    value: deserializeValue(setting.value),
  }))
}

export async function getSetting(key: string) {
  const setting = await getPrisma().siteSetting.findUnique({ where: { key } })

  if (!setting) {
    throw notFound('Setting not found.')
  }

  return {
    ...setting,
    value: deserializeValue(setting.value),
  }
}

export async function upsertSetting(key: string, value: unknown) {
  const setting = await getPrisma().siteSetting.upsert({
    where: { key },
    update: {
      value: serializeValue(value),
    },
    create: {
      key,
      value: serializeValue(value),
    },
  })

  return {
    ...setting,
    value: deserializeValue(setting.value),
  }
}

export async function upsertSettings(updates: Array<{ key: string; value: unknown }>) {
  const prisma = getPrisma()
  const settings = await prisma.$transaction(updates.map((update) => prisma.siteSetting.upsert({
    where: { key: update.key },
    update: { value: serializeValue(update.value) },
    create: { key: update.key, value: serializeValue(update.value) },
  })))

  return settings.map((setting) => ({
    ...setting,
    value: deserializeValue(setting.value),
  }))
}

export async function getSiteSettingsMap() {
  const settings = await listSettings()

  return Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
}
