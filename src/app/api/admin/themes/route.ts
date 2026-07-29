import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { handleApiError, json } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { listThemes, writeThemeCss } from '@/lib/theme'
import { assertThemeName } from '@/lib/validations/theme'

const MAX_UPLOAD_BYTES = 100 * 1024

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

    const formData = await request.formData()
    const name = assertThemeName(formData.get('name'))
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: { code: 'THEME_FILE_REQUIRED', message: 'Choose a CSS theme file.' } }, { status: 400 })
    }

    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: { code: 'INVALID_THEME_FILE_SIZE', message: 'Theme CSS must be between 1 byte and 100 KB.' } }, { status: 400 })
    }

    if (file.type && file.type !== 'text/css') {
      return NextResponse.json({ error: { code: 'INVALID_THEME_FILE', message: 'Theme files must use the CSS format.' } }, { status: 400 })
    }

    const theme = await writeThemeCss(name, await file.text())
    revalidatePath('/(public)', 'layout')

    return json({ theme }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
