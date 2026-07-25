import { handleApiError, json } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { archiveArticle } from '@/lib/services/article-service'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()

    const { id } = await params
    const article = await archiveArticle(id)

    return json({ article })
  } catch (error) {
    return handleApiError(error)
  }
}
