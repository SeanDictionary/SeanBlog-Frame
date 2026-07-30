import { handleApiError, json } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { publishArticle } from '@/lib/services/article-service'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const { id } = await params
    const article = await publishArticle(id)

    return json({ article })
  } catch (error) {
    return handleApiError(error)
  }
}
