import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { handleApiError, json } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { installThemePackageFromZip, listThemes } from '@/lib/theme'

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
    await requireAdmin()
    requireSameOriginRequest(request)

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: { code: 'THEME_PACKAGE_REQUIRED', message: 'Choose a .zip theme package.' } }, { status: 400 })
    }

    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: { code: 'INVALID_THEME_PACKAGE_SIZE', message: 'Theme packages must be between 1 byte and 2 MB.' } }, { status: 400 })
    }

    if (!file.name.endsWith('.zip') && file.type && !['application/zip', 'application/x-zip-compressed', 'application/octet-stream'].includes(file.type)) {
      return NextResponse.json({ error: { code: 'INVALID_THEME_PACKAGE', message: 'Theme packages must use the .zip format.' } }, { status: 400 })
    }

    const theme = await installThemePackageFromZip(file)
    revalidatePath('/(public)', 'layout')

    return json({ theme }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
