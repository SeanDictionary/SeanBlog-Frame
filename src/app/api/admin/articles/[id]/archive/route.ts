import { handleApiError, json } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { archiveArticle } from '@/lib/services/article-service'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const { id } = await params
    const article = await recordOperation({
      actor: adminLogActor(session),
      module: 'article',
      action: 'archive',
      targetType: 'article',
      targetId: id,
      summary: (archivedArticle) => `归档文章：${archivedArticle.title}`,
      failureSummary: `归档文章失败：${id}`,
      metadata: (archivedArticle) => ({ slug: archivedArticle.slug, status: archivedArticle.status }),
      request,
    }, () => archiveArticle(id))

    return json({ article })
  } catch (error) {
    return handleApiError(error)
  }
}
