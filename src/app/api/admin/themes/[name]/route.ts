import { revalidatePath } from 'next/cache'

import { handleApiError, noContent } from '@/lib/api/response'
import { conflict } from '@/lib/api/errors'
import { requireAdmin } from '@/lib/auth.utils'
import { getSiteSettingsMap } from '@/lib/services/setting-service'
import { deleteTheme, readThemeCss } from '@/lib/theme'
import { assertThemeName, DEFAULT_THEME_NAME } from '@/lib/validations/theme'

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    await requireAdmin()

    const { name: rawName } = await params
    const name = assertThemeName(rawName)
    const css = await readThemeCss(name)

    if (!css) {
      return new Response('Theme not found.', { status: 404 })
    }

    return new Response(css, {
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}.css"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    await requireAdmin()

    const { name: rawName } = await params
    const name = assertThemeName(rawName)
    const settings = await getSiteSettingsMap()

    if (name === DEFAULT_THEME_NAME || settings.activeTheme === name) {
      throw conflict('Switch to another theme before deleting this theme.')
    }

    await deleteTheme(name)
    revalidatePath('/(public)', 'layout')

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
