import { buildHomeCtx } from '@/lib/theme/template-context'
import { renderThemePage } from '@/lib/theme/render-service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ctx = await buildHomeCtx({
    page: url.searchParams.get('page') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
  })
  const html = await renderThemePage({ pageKey: 'home', ctx })
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
