import { handleApiError, json } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { publishArticle } from '@/lib/services/article-service'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()

    const { id } = await params
    const article = await publishArticle(id)

    return json({ article })
  } catch (error) {
    return handleApiError(error)
  }
}
