import { handleApiError, json } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { archiveArticle } from '@/lib/services/article-service'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const { id } = await params
    const article = await archiveArticle(id)

    return json({ article })
  } catch (error) {
    return handleApiError(error)
  }
}
