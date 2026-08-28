import { notFound } from '@/lib/api/errors'
import { renderThemePage } from '@/lib/theme/render-service'
import { buildPostCtx } from '@/lib/theme/template-context'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const ctx = await buildPostCtx(slug)
    const html = await renderThemePage({ pageKey: 'post', ctx })
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiError') {
      return new Response('Article not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
    }
    throw error
  }
}
