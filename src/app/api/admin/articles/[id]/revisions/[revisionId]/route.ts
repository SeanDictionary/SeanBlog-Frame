import { handleApiError, json } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { getAdminArticleRevision } from '@/lib/services/article-service'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; revisionId: string }> }) {
  try {
    await requireAdmin()

    const { id, revisionId } = await params
    const revision = await getAdminArticleRevision(id, revisionId)

    return json({ revision })
  } catch (error) {
    return handleApiError(error)
  }
}
