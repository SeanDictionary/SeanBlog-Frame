import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'

const unsafeCssPattern = /<\/?(?:script|style|iframe)|javascript:|on\w+\s*=|@import/gi

export async function POST(request: Request) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const css = typeof body.css === 'string' ? body.css : ''

    if (!css.trim()) {
      return json({ valid: false, error: 'CSS 不能为空。' })
    }

    if (Buffer.byteLength(css, 'utf8') > 100 * 1024) {
      return json({ valid: false, error: 'CSS 不能超过 100KB。' })
    }

    const unsafeMatch = css.match(unsafeCssPattern)
    if (unsafeMatch) {
      return json({ valid: false, error: `CSS 包含不安全内容: ${unsafeMatch[0]}` })
    }

    return json({ valid: true })
  } catch (error) {
    return handleApiError(error)
  }
}
