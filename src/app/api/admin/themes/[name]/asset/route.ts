import { readThemeAsset } from '@/lib/theme'
import { assertThemeName, DEFAULT_THEME_NAME } from '@/lib/validations/theme'
import { handleApiError } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'

function contentTypeFor(path: string) {
  if (path.endsWith('.css')) return 'text/css; charset=utf-8'
  if (path.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (path.endsWith('.svg')) return 'image/svg+xml; charset=utf-8'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    await requireAdmin()

    const { name: rawName } = await params
    const { searchParams } = new URL(request.url)
    const assetPath = searchParams.get('path') ?? ''
    const name = rawName === 'default' ? DEFAULT_THEME_NAME : assertThemeName(rawName)
    const asset = await readThemeAsset(name, assetPath)

    return new Response(new Uint8Array(asset), {
      headers: {
        'Content-Type': contentTypeFor(assetPath),
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
