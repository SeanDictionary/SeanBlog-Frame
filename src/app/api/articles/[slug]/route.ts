import { handleApiError, json } from '@/lib/api/response'
import { canDisplayArticleComments, resolveArticleCommentsMode } from '@/lib/comment-settings'
import { getPublicArticleBySlug } from '@/lib/services/article-service'
import { getSiteSettingsMap } from '@/lib/services/setting-service'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const [article, settings] = await Promise.all([getPublicArticleBySlug(slug), getSiteSettingsMap()])
    const commentsMode = resolveArticleCommentsMode(settings.articleCommentsMode)

    return json({
      article: canDisplayArticleComments(commentsMode)
        ? article
        : { ...article, comments: [] },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
