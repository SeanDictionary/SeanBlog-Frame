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

  invalidateSiteUrlCache([{ key }])

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

  invalidateSiteUrlCache(updates)

  return settings.map((setting) => ({
    ...setting,
    value: deserializeValue(setting.value),
  }))
}

export async function getSiteSettingsMap() {
  const settings = await listSettings()

  return Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
}

/** 站点 URL 缺省值：管理员未在后台配置时的兜底。 */
const DEFAULT_SITE_URL = 'http://localhost:3000'

// 站点 URL 短缓存：避免 root layout 的 generateMetadata、robots、CSRF 校验等
// 高频路径每个请求都查库。TTL 到期后下次调用重新加载。
// 管理员保存 siteUrl 时会主动失效（见 upsertSetting / upsertSettings），
// 配合 admin/settings 路由的 revalidatePath，新值很快全局生效。
const SITE_URL_CACHE_TTL_MS = 30_000
let siteUrlCache: { value: string; expiresAt: number } | null = null

function invalidateSiteUrlCache(keys: Array<{ key: string }>) {
  if (keys.some((item) => item.key === 'siteUrl')) {
    siteUrlCache = null
  }
}

/**
 * 读取站点 URL（后台 siteUrl 设置优先，缺省 http://localhost:3000）。
 * 带短 TTL 缓存，适合在 generateMetadata、robots 等异步路径调用。
 */
export async function getSiteUrl(): Promise<string> {
  const now = Date.now()
  if (siteUrlCache && siteUrlCache.expiresAt > now) {
    return siteUrlCache.value
  }

  let value = DEFAULT_SITE_URL
  try {
    const setting = await getPrisma().siteSetting.findUnique({ where: { key: 'siteUrl' } })
    if (setting) {
      const deserialized = deserializeValue(setting.value)
      if (typeof deserialized === 'string' && deserialized.trim()) {
        value = deserialized
      }
    }
  } catch (error) {
    console.error('[settings] failed to load siteUrl, falling back to default:', error)
  }

  const normalized = value.replace(/\/$/, '')
  siteUrlCache = { value: normalized, expiresAt: now + SITE_URL_CACHE_TTL_MS }
  return normalized
}

/**
 * 站点 URL 的同步快照（直接读缓存，不触发查库）。
 * 缓存未预热时返回 null。供 request-guard 这类同步路径使用；
 * 站点 URL 由 root layout 的 generateMetadata 在首次页面渲染时预热，
 * 管理员到达 API 调用前必然先加载过页面，故实际不会长期为 null。
 */
export function getSiteUrlSync(): string | null {
  if (siteUrlCache && siteUrlCache.expiresAt > Date.now()) {
    return siteUrlCache.value
  }
  return null
}

/**
 * Returns the site settings map, or an empty object when the database is
 * unavailable. Used by always-on chrome (public layout, admin sidebar) so a
 * database outage degrades to defaults instead of crashing the whole shell.
 */
export async function getSiteSettingsMapSafe(): Promise<Record<string, unknown>> {
  try {
    return await getSiteSettingsMap()
  } catch (error) {
    console.error('[settings] failed to load site settings, falling back to empty map:', error)
    return {}
  }
}
