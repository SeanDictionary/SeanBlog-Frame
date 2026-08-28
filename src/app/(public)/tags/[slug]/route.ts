import { buildTaxonomyCtx } from '@/lib/theme/template-context'
import { renderThemePage } from '@/lib/theme/render-service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const url = new URL(request.url)
  const ctx = await buildTaxonomyCtx('tag', slug, { page: url.searchParams.get('page') ?? undefined })
  const html = await renderThemePage({ pageKey: 'taxonomy', ctx })
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
