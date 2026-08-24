import { revalidatePath } from 'next/cache'

import { badRequest } from '@/lib/api/errors'
import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { listSettings, upsertSettings } from '@/lib/services/setting-service'
import { normalizeThemeName, readThemeManifest } from '@/lib/theme'
import { settingBulkUpdateSchema } from '@/lib/validations/cms'

const settingScopeLabels = {
  analytics: '访问统计设置',
  'article-meta': '文章元数据设置',
  'public-layout': 'Header / Footer 设置',
  'theme-settings': '主题设置',
  'object-storage': '对象存储设置',
  'site-info': '站点信息',
} satisfies Record<string, string>

function assertThemeSettingUpdates(themeSlug: string | undefined, updates: Array<{ key: string; value: unknown }>) {
  if (!themeSlug) return

  const normalizedThemeSlug = normalizeThemeName(themeSlug)
  const manifestPromise = readThemeManifest(normalizedThemeSlug)

  return manifestPromise.then((manifest) => {
    const schema = new Map((manifest.settingsSchema ?? []).map((item) => [item.key, item]))

    for (const update of updates) {
      const prefix = `themeSetting:${manifest.slug}:`
      if (!update.key.startsWith(prefix)) continue

      const item = schema.get(update.key.slice(prefix.length))
      if (!item) {
        throw badRequest('Theme setting key is not declared by the active theme.', 'INVALID_THEME_SETTING')
      }

      if (item.type === 'boolean' && typeof update.value !== 'boolean') throw badRequest(`Theme setting ${item.key} must be boolean.`, 'INVALID_THEME_SETTING')
      if (item.type !== 'boolean' && typeof update.value !== 'string' && typeof update.value !== 'number') throw badRequest(`Theme setting ${item.key} has an invalid value.`, 'INVALID_THEME_SETTING')
      if (item.type === 'select' && (!item.options || !item.options.some((option) => option.value === update.value))) throw badRequest(`Theme setting ${item.key} has an invalid option.`, 'INVALID_THEME_SETTING')
    }
  })
}

function revalidateSettings(keys: string[]) {
  if (keys.some((key) => key.startsWith('analytics'))) {
    revalidatePath('/admin/overview')
    revalidatePath('/admin/visitors')
  }

  if (keys.some((key) => key.startsWith('articleMeta'))) {
    revalidatePath('/articles/[slug]', 'page')
  }

  if (keys.some((key) => key.startsWith('publicHeader') || key.startsWith('publicFooter') || key.startsWith('themeSetting:') || keys.includes('siteName') || keys.includes('siteDescription') || keys.includes('siteUrl'))) {
    revalidatePath('/(public)', 'layout')
    revalidatePath('/rss.xml')
  }
}

export async function GET() {
  try {
    await requireAdmin()

    const settings = await listSettings()
    return json({ settings })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = settingBulkUpdateSchema.parse(body)
    const normalizedThemeSlug = input.themeSlug ? normalizeThemeName(input.themeSlug) : undefined
    if (input.scope === 'theme-settings' && normalizedThemeSlug) {
      await assertThemeSettingUpdates(normalizedThemeSlug, input.updates)
    }
    const keys = input.updates.map((update) => update.key)
    const settings = await recordOperation({
      actor: adminLogActor(session),
      module: 'setting',
      action: 'bulk-update',
      targetType: 'setting-group',
      targetId: input.scope,
      summary: `更新${settingScopeLabels[input.scope]}`,
      failureSummary: `更新${settingScopeLabels[input.scope]}失败`,
      metadata: { scope: input.scope, keys, count: keys.length, ...(normalizedThemeSlug ? { themeSlug: normalizedThemeSlug } : {}) },
      failureMetadata: { scope: input.scope, keys, count: keys.length, ...(normalizedThemeSlug ? { themeSlug: normalizedThemeSlug } : {}) },
      request,
    }, () => upsertSettings(input.updates))

    revalidateSettings(keys)

    return json({ settings })
  } catch (error) {
    return handleApiError(error)
  }
}
