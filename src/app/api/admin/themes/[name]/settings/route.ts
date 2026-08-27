import { revalidatePath } from 'next/cache'

import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { saveThemeSettings } from '@/lib/services/theme-settings-service'
import { normalizeThemeName, readThemeManifest } from '@/lib/theme'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const { name: rawName } = await params
    const slug = normalizeThemeName(rawName)
    const body = await parseJson(request)
    const settings: Record<string, unknown> = body.settings

    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return json({ error: { message: 'settings must be an object' } }, { status: 400 })
    }

    // Validate settings against theme schema
    const manifest = await readThemeManifest(slug)
    const schema = manifest.settingsSchema ?? []
    for (const item of schema) {
      const value = settings[item.key]
      if (value === undefined) continue

      if (item.type === 'boolean' && typeof value !== 'boolean') {
        return json({ error: { message: `${item.key} must be boolean` } }, { status: 400 })
      }
      if (item.type === 'select' && typeof value === 'string' && item.options && !item.options.some((o) => o.value === value)) {
        return json({ error: { message: `${item.key} has invalid option: ${value}` } }, { status: 400 })
      }
      if (item.type === 'multiselect' && !Array.isArray(value)) {
        return json({ error: { message: `${item.key} must be an array` } }, { status: 400 })
      }
    }

    await recordOperation({
      actor: adminLogActor(session),
      module: 'theme',
      action: 'update-settings',
      targetType: 'theme',
      targetId: slug,
      summary: `更新主题设置: ${slug}`,
      failureSummary: `更新主题设置失败: ${slug}`,
      metadata: { slug, keys: Object.keys(settings) },
      failureMetadata: { slug, keys: Object.keys(settings) },
      request,
    }, () => saveThemeSettings(slug, settings))

    revalidatePath('/', 'layout')

    return json({ ok: true, slug, settings })
  } catch (error) {
    return handleApiError(error)
  }
}
