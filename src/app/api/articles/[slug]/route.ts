import { handleApiError, json } from '@/lib/api/response'
import { canDisplayArticleComments, fromPrismaArticleCommentsMode } from '@/lib/comment-settings'
import { getPublicArticleBySlug } from '@/lib/services/article-service'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const article = await getPublicArticleBySlug(slug)
    const commentsMode = fromPrismaArticleCommentsMode(article.commentsMode)

    return json({
      article: canDisplayArticleComments(commentsMode)
        ? article
        : { ...article, comments: [] },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
