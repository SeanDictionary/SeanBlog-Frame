import { publicErrorResponse } from '@/lib/theme/public-error-page'
import { renderThemePage } from '@/lib/theme/render-service'
import { buildCategoriesIndexCtx } from '@/lib/theme/template-context'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const ctx = await buildCategoriesIndexCtx({ page: url.searchParams.get('page') ?? undefined })
    const html = await renderThemePage({ pageKey: 'categories', ctx })
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  } catch (error) {
    return publicErrorResponse(error)
  }
}
