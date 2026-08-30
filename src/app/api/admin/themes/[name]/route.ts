import { revalidatePath } from 'next/cache'

import { handleApiError, noContent } from '@/lib/api/response'
import { conflict } from '@/lib/api/errors'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { getSiteSettingsMap } from '@/lib/services/setting-service'
import { deleteTheme, exportThemePackage, readThemeManifest } from '@/lib/theme'
import { buildThemeSettingsSnapshot, deleteThemeSettings } from '@/lib/services/theme-settings-service'
import { assertThemeName, DEFAULT_THEME_NAME } from '@/lib/validations/theme'

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const session = await requireAdmin()

    const { name: rawName } = await params
    const name = rawName === 'default' ? DEFAULT_THEME_NAME : assertThemeName(rawName)
    const includeSettings = new URL(request.url).searchParams.get('includeSettings') === 'true'
    const payload = await recordOperation({
      actor: adminLogActor(session),
      module: 'theme',
      action: 'export',
      targetType: 'theme',
      targetId: name,
      summary: `导出主题包：${name}`,
      failureSummary: `导出主题包失败：${name}`,
      metadata: { slug: name, includeSettings },
      request,
    }, async () => {
      const manifest = await readThemeManifest(name)
      const extraEntries = includeSettings
        ? [{
            path: 'theme-settings.json',
            content: Buffer.from(JSON.stringify(await buildThemeSettingsSnapshot(name), null, 2), 'utf8'),
          }]
        : []
      const zip = await exportThemePackage(name, extraEntries)
      return { manifest, zip }
    })

    return new Response(new Uint8Array(payload.zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${payload.manifest.slug}-${payload.manifest.version}.zip"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const { name: rawName } = await params
    const name = rawName === 'default' ? DEFAULT_THEME_NAME : assertThemeName(rawName)
    await recordOperation({
      actor: adminLogActor(session),
      module: 'theme',
      action: 'delete',
      targetType: 'theme',
      targetId: name,
      summary: `删除主题包：${name}`,
      failureSummary: `删除主题包失败：${name}`,
      request,
    }, async () => {
      const settings = await getSiteSettingsMap()
      const activeTheme = settings.activeTheme === 'default' ? DEFAULT_THEME_NAME : settings.activeTheme

      if (name === DEFAULT_THEME_NAME || activeTheme === name) {
        throw conflict('Switch to another theme package before deleting this theme.')
      }

      await deleteTheme(name)
      await deleteThemeSettings(name)
    })

    revalidatePath('/(public)', 'layout')

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
