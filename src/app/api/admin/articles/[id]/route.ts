import { handleApiError, json, noContent, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { deleteArticle, getAdminArticleById, updateArticle } from '@/lib/services/article-service'
import { articleUpdateSchema } from '@/lib/validations/cms'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()

    const { id } = await params
    const article = await getAdminArticleById(id)

    return json({ article })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const [{ id }, body] = await Promise.all([params, parseJson(request)])
    const input = articleUpdateSchema.parse(body)
    const article = await recordOperation({
      actor: adminLogActor(session),
      module: 'article',
      action: 'update',
      targetType: 'article',
      targetId: id,
      summary: (updatedArticle) => `更新文章：${updatedArticle.title}`,
      failureSummary: `更新文章失败：${id}`,
      metadata: (updatedArticle) => ({ slug: updatedArticle.slug, status: updatedArticle.status }),
      failureMetadata: { fields: Object.keys(input) },
      request,
    }, () => updateArticle(id, input))

    return json({ article })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const { id } = await params
    await recordOperation({
      actor: adminLogActor(session),
      module: 'article',
      action: 'delete',
      targetType: 'article',
      targetId: id,
      summary: `删除文章：${id}`,
      failureSummary: `删除文章失败：${id}`,
      request,
    }, () => deleteArticle(id))

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
