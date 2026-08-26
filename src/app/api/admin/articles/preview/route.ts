import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { markdownToHtml } from '@/lib/content/markdown'
import { buildThemeCssBundle } from '@/lib/theme/css-bundle'
import { markdownPreviewSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = markdownPreviewSchema.parse(body)
    const [html, themeCssBundle] = await Promise.all([
      markdownToHtml(input.markdown),
      buildThemeCssBundle(),
    ])

    return json({ html, themeCss: themeCssBundle?.css ?? '', calloutCss: themeCssBundle?.calloutCss ?? '' })
  } catch (error) {
    return handleApiError(error)
  }
}
