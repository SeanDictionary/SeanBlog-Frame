import { handleApiError, json } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { publishArticle } from '@/lib/services/article-service'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const { id } = await params
    const article = await recordOperation({
      actor: adminLogActor(session),
      module: 'article',
      action: 'publish',
      targetType: 'article',
      targetId: id,
      summary: (publishedArticle) => `发布文章：${publishedArticle.title}`,
      failureSummary: `发布文章失败：${id}`,
      metadata: (publishedArticle) => ({ slug: publishedArticle.slug, status: publishedArticle.status }),
      request,
    }, () => publishArticle(id))

    return json({ article })
  } catch (error) {
    return handleApiError(error)
  }
}
