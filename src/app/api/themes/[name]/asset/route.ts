import { handleApiError } from '@/lib/api/response'
import { readThemeAsset } from '@/lib/theme'
import { assertThemeName, DEFAULT_THEME_NAME } from '@/lib/validations/theme'

function contentTypeFor(path: string) {
  if (path.endsWith('.css')) return 'text/css; charset=utf-8'
  if (path.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (path.endsWith('.svg')) return 'image/svg+xml; charset=utf-8'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.woff2')) return 'font/woff2'
  return 'application/octet-stream'
}

/**
 * 读取主题资产，文件不存在时返回 null（让路由以 404 响应）。
 * 路径越界等非法路径仍抛 badRequest，交由上层 handleApiError 处理。
 */
async function tryReadThemeAsset(name: string, assetPath: string) {
  try {
    return await readThemeAsset(name, assetPath)
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name: rawName } = await params
    const { searchParams } = new URL(request.url)
    const name = rawName === 'default' ? DEFAULT_THEME_NAME : assertThemeName(rawName)
    let assetPath = searchParams.get('path') ?? ''

    let asset = await tryReadThemeAsset(name, assetPath)

    // 兼容中间层（阿里云 CDN / 1Panel WAF / frp）对查询串的二次编码：
    // 客户端发出 path=assets%2Fjs%2Fmain.js，被中间层把 % 再编码成 %25，到达时是 %252F。
    // URLSearchParams 已解码一次（%252F -> %2F），若仍未命中且残留 %，再解码一次重试。
    if (asset === null && assetPath.includes('%')) {
      try {
        asset = await tryReadThemeAsset(name, decodeURIComponent(assetPath))
      } catch {
        asset = null
      }
    }

    if (asset === null) {
      return new Response('Not Found', { status: 404 })
    }

    return new Response(new Uint8Array(asset), {
      headers: {
        'Content-Type': contentTypeFor(assetPath),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
