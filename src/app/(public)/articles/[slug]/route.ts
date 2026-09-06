import { publicErrorResponse } from '@/lib/theme/public-error-page'
import { renderNotFoundResponse, renderThemePage } from '@/lib/theme/render-service'
import { buildPostCtx } from '@/lib/theme/template-context'
import { ApiError } from '@/lib/api/errors'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const ctx = await buildPostCtx(slug)
    const html = await renderThemePage({ pageKey: 'post', ctx })
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return renderNotFoundResponse()
    }
    return publicErrorResponse(error)
  }
}
