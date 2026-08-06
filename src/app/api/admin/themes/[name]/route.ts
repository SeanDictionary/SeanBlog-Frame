import { revalidatePath } from 'next/cache'

import { handleApiError, noContent } from '@/lib/api/response'
import { conflict } from '@/lib/api/errors'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { getSiteSettingsMap } from '@/lib/services/setting-service'
import { deleteTheme, exportThemePackage, readThemeManifest } from '@/lib/theme'
import { assertThemeName, DEFAULT_THEME_NAME } from '@/lib/validations/theme'

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    await requireAdmin()

    const { name: rawName } = await params
    const name = rawName === 'default' ? DEFAULT_THEME_NAME : assertThemeName(rawName)
    const manifest = await readThemeManifest(name)
    const zip = await exportThemePackage(name)

    return new Response(new Uint8Array(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${manifest.slug}-${manifest.version}.zip"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const { name: rawName } = await params
    const name = rawName === 'default' ? DEFAULT_THEME_NAME : assertThemeName(rawName)
    const settings = await getSiteSettingsMap()
    const activeTheme = settings.activeTheme === 'default' ? DEFAULT_THEME_NAME : settings.activeTheme

    if (name === DEFAULT_THEME_NAME || activeTheme === name) {
      throw conflict('Switch to another theme package before deleting this theme.')
    }

    await deleteTheme(name)
    revalidatePath('/(public)', 'layout')

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
