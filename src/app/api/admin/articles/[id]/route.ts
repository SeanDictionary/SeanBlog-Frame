import { handleApiError, json, noContent, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
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
    await requireAdmin()
    requireSameOriginRequest(request)

    const [{ id }, body] = await Promise.all([params, parseJson(request)])
    const input = articleUpdateSchema.parse(body)
    const article = await updateArticle(id, input)

    return json({ article })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const { id } = await params
    await deleteArticle(id)

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
