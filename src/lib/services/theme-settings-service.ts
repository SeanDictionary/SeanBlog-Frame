/**
 * 主题自定义设置服务
 *
 * 从 ThemeCustomization 表读取主题设置，与 settingsSchema 默认值合并后返回。
 * 使用 unstable_cache 缓存 5 分钟，保存时通过 tag 失效。
 */

import { unstable_cache, revalidateTag, revalidatePath } from 'next/cache'

import { getPrisma } from '@/lib/prisma'
import { flattenSchemaItems, readThemeManifest, type SettingsSchema } from '@/lib/theme'
import {
  createThemeSettingsSnapshot,
  prepareThemeSettingsSnapshot,
  type ThemeSettingsImportMode,
  type ThemeSettingsSnapshot,
} from '@/lib/theme/settings-snapshot'
import { getSiteSettingsMapSafe } from '@/lib/services/setting-service'

/** 合并数据库设置与 schema 默认值 */
function mergeWithDefaults(
  schema: SettingsSchema | undefined,
  dbSettings: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (schema) {
    for (const item of flattenSchemaItems(schema)) {
      const dbValue = dbSettings[item.key]
      if (dbValue !== undefined) {
        result[item.key] = dbValue
      } else if (item.default !== undefined) {
        result[item.key] = item.default
      }
    }
  }
  // 保留数据库中有但 schema 中没有的（如 calloutCustomCss）
  for (const [k, v] of Object.entries(dbSettings)) {
    if (!(k in result)) result[k] = v
  }
  return result
}

/** 从数据库读取主题原始设置（未合并默认值） */
async function fetchRawThemeSettings(themeSlug: string): Promise<Record<string, unknown>> {
  const row = await getPrisma().themeCustomization.findUnique({
    where: { themeSlug },
  })
  if (!row) return {}
  const settings = row.settings
  return settings && typeof settings === 'object' && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {}
}

/** 带缓存的读取：合并 settingsSchema 默认值 + 数据库自定义 */
export const getThemeSettings = unstable_cache(
  async (themeSlug: string): Promise<Record<string, unknown>> => {
    const [raw, manifest] = await Promise.all([
      fetchRawThemeSettings(themeSlug),
      readThemeManifest(themeSlug).catch(() => null),
    ])
    return mergeWithDefaults(manifest?.settingsSchema, raw)
  },
  ['theme-settings'],
  {
    revalidate: 300,
    tags: ['theme-settings'],
  },
)

/** 读取当前活跃主题的设置（合并默认值后） */
export async function getActiveThemeSettings(): Promise<{ themeSlug: string; settings: Record<string, unknown> }> {
  const siteSettings = await getSiteSettingsMapSafe()
  const activeTheme = typeof siteSettings.activeTheme === 'string' && siteSettings.activeTheme !== 'default'
    ? siteSettings.activeTheme
    : 'seanblog-default'
  const themeSettings = await getThemeSettings(activeTheme)
  return { themeSlug: activeTheme, settings: themeSettings }
}

/** 从主题数据库读取原始用户设置（不含默认值）。 */
export async function getRawThemeSettings(themeSlug: string): Promise<Record<string, unknown>> {
  return fetchRawThemeSettings(themeSlug)
}

/** 返回当前主题的有效设置（用户值 + 当前 schema 默认值）。 */
export async function getEffectiveThemeSettings(themeSlug: string): Promise<Record<string, unknown>> {
  const [raw, manifest] = await Promise.all([
    fetchRawThemeSettings(themeSlug),
    readThemeManifest(themeSlug),
  ])
  return mergeWithDefaults(manifest.settingsSchema, raw)
}

/** 生成主题导出用的全量有效设置快照。 */
export async function buildThemeSettingsSnapshot(themeSlug: string): Promise<ThemeSettingsSnapshot> {
  const [manifest, effective] = await Promise.all([
    readThemeManifest(themeSlug),
    getEffectiveThemeSettings(themeSlug),
  ])
  const knownKeys = new Set(flattenSchemaItems(manifest.settingsSchema ?? {}).map((item) => item.key))
  const settings = Object.fromEntries(
    Object.entries(effective).filter(([key]) => knownKeys.has(key) || key === 'calloutCustomCss'),
  )
  return createThemeSettingsSnapshot({ manifest, settings })
}

/** 删除主题对应的数据库自定义设置；可重复执行。 */
export async function deleteThemeSettings(themeSlug: string) {
  await getPrisma().themeCustomization.deleteMany({ where: { themeSlug } })
  revalidateTag('theme-settings', 'default')
  revalidatePath('/', 'layout')
}

/**
 * 按导入模式应用设置快照。
 * preserve 仅在当前主题没有任何数据库设置时导入；restore 使用快照覆盖当前原始设置。
 */
export async function applyThemeSettingsSnapshot(
  themeSlug: string,
  snapshot: ThemeSettingsSnapshot,
  mode: ThemeSettingsImportMode,
): Promise<{ applied: boolean; warnings: string[] }> {
  if (mode === 'ignore') return { applied: false, warnings: [] }
  const manifest = await readThemeManifest(themeSlug)
  const prepared = prepareThemeSettingsSnapshot(snapshot, manifest)
  const existingRow = await getPrisma().themeCustomization.findUnique({
    where: { themeSlug },
    select: { themeSlug: true },
  })

  if (mode === 'preserve' && existingRow) {
    return { applied: false, warnings: prepared.warnings }
  }

  const settings = prepared.settings
  await getPrisma().themeCustomization.upsert({
    where: { themeSlug },
    update: { settings: settings as any },
    create: { themeSlug, settings: settings as any },
  })
  revalidateTag('theme-settings', 'default')
  revalidatePath('/', 'layout')
  return { applied: true, warnings: prepared.warnings }
}

/** 保存主题设置（写入数据库 + 失效缓存） */
export async function saveThemeSettings(themeSlug: string, settings: Record<string, unknown>) {
  // 合并已有设置，避免部分更新覆盖全部
  const existing = await fetchRawThemeSettings(themeSlug)
  const merged = { ...existing, ...settings }

  await getPrisma().themeCustomization.upsert({
    where: { themeSlug },
    update: { settings: merged as any },
    create: { themeSlug, settings: merged as any },
  })
  revalidateTag('theme-settings', 'default')
  revalidatePath('/', 'layout')
}

/** 获取主题设置 + 系统设置的合并 map（供 CSS bundle 使用） */
export async function getMergedSettings(): Promise<Record<string, unknown>> {
  const [siteSettings, { themeSlug, settings: themeSettings }] = await Promise.all([
    getSiteSettingsMapSafe(),
    getActiveThemeSettings(),
  ])
  return {
    ...siteSettings,
    activeTheme: themeSlug,
    ...themeSettings,
  }
}
