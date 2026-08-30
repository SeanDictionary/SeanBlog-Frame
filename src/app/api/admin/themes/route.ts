import { revalidatePath } from 'next/cache'

import { badRequest } from '@/lib/api/errors'
import { handleApiError, json } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { installThemePackageFromZip, listThemes, deleteTheme } from '@/lib/theme'
import { applyThemeSettingsSnapshot } from '@/lib/services/theme-settings-service'
import type { ThemeSettingsImportMode } from '@/lib/theme/settings-snapshot'

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

export async function GET() {
  try {
    await requireAdmin()
    return json({ themes: await listThemes() })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const formData = await request.formData()
    const file = formData.get('file')
    const rawSettingsMode = formData.get('settingsMode')
    const settingsMode: ThemeSettingsImportMode = rawSettingsMode === null
      ? 'preserve'
      : rawSettingsMode === 'ignore' || rawSettingsMode === 'preserve' || rawSettingsMode === 'restore'
        ? rawSettingsMode
        : (() => { throw badRequest('Invalid theme settings import mode.', 'INVALID_THEME_SETTINGS_MODE') })()

    const theme = await recordOperation({
      actor: adminLogActor(session),
      module: 'theme',
      action: 'install',
      targetType: 'theme',
      targetId: (installedTheme) => installedTheme.slug,
      summary: (installedTheme) => `安装主题包：${installedTheme.slug}`,
      failureSummary: '安装主题包失败',
      metadata: (installedTheme) => ({ slug: installedTheme.slug, settingsMode, settingsApplied: installedTheme.settingsResult.applied }),
      request,
    }, async () => {
      if (!(file instanceof File)) {
        throw badRequest('Choose a .zip theme package.', 'THEME_PACKAGE_REQUIRED')
      }

      if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
        throw badRequest('Theme packages must be between 1 byte and 2 MB.', 'INVALID_THEME_PACKAGE_SIZE')
      }

      if (!file.name.endsWith('.zip') && file.type && !['application/zip', 'application/x-zip-compressed', 'application/octet-stream'].includes(file.type)) {
        throw badRequest('Theme packages must use the .zip format.', 'INVALID_THEME_PACKAGE')
      }

      const installed = await installThemePackageFromZip(file, settingsMode)
      try {
        const settingsResult = installed.settingsSnapshot
          ? await applyThemeSettingsSnapshot(installed.slug, installed.settingsSnapshot, settingsMode)
          : { applied: false, warnings: [] as string[] }
        return { ...installed, settingsResult }
      } catch (error) {
        await deleteTheme(installed.slug).catch(() => undefined)
        throw error
      }
    })

    revalidatePath('/(public)', 'layout')

    return json({
      theme: theme.slug,
      settingsApplied: theme.settingsResult.applied,
      warnings: theme.settingsResult.warnings,
    }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
