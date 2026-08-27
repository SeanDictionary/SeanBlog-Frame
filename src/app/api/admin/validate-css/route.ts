import postcss from 'postcss'
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

    // XSS 检查
    const unsafeMatch = css.match(unsafeCssPattern)
    if (unsafeMatch) {
      return json({ valid: false, error: `CSS 包含不安全内容: ${unsafeMatch[0]}` })
    }

    // CSS 语法校验（用 PostCSS 解析）
    try {
      postcss.parse(css)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSS 语法错误'
      // PostCSS 错误信息通常包含行号和原因，提取关键部分
      const shortMessage = message.split('\n')[0]
      return json({ valid: false, error: shortMessage })
    }

    return json({ valid: true })
  } catch (error) {
    return handleApiError(error)
  }
}
