import { handleApiError, json } from '@/lib/api/response'
import { getPublicArticleBySlug } from '@/lib/services/article-service'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const article = await getPublicArticleBySlug(slug)

    return json({ article })
  } catch (error) {
    return handleApiError(error)
  }
}
