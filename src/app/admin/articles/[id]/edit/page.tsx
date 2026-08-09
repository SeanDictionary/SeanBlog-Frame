import { notFound } from 'next/navigation'

import { ArticleEditor } from '@/components/admin/article-editor'
import { fromPrismaArticleCommentsMode } from '@/lib/comment-settings'
import { isDatabaseError } from '@/lib/database-errors'
import { getAdminArticleById } from '@/lib/services/article-service'
import { listCategories } from '@/lib/services/category-service'
import { listTags } from '@/lib/services/tag-service'

type EditArticlePageProps = {
  params: Promise<{ id: string }>
}

export default async function EditArticlePage({ params }: EditArticlePageProps) {
  const { id } = await params

  try {
    const [article, categories, tags] = await Promise.all([getAdminArticleById(id), listCategories(), listTags()])

    return (
      <ArticleEditor
        article={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt,
          contentMarkdown: article.contentMarkdown,
          contentHtml: article.contentHtml,
          coverImage: article.coverImage,
          status: article.status,
          commentsMode: fromPrismaArticleCommentsMode(article.commentsMode),
          publishedAt: article.publishedAt,
          expiresAt: article.expiresAt,
          updatedAt: article.updatedAt,
          revisions: article.revisions,
          categoryId: article.categoryId,
          tagIds: article.tags.map((tag) => tag.id),
          isPinned: article.isPinned,
          metaTitle: article.metaTitle,
          metaDescription: article.metaDescription,
          metaKeywords: article.metaKeywords,
        }}
        categories={categories}
        tags={tags}
      />
    )
  } catch (error) {
    if (isDatabaseError(error)) throw error
    notFound()
  }
}
