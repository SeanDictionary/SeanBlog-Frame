import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ArticleEditor } from '@/components/admin/article-editor'
import { fromPrismaArticleCommentsMode } from '@/lib/comment-settings'
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
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm text-neutral-500">内容管理</p>
            <h1 className="text-3xl font-semibold tracking-tight">编辑文章</h1>
          </div>
          <Link href="/admin/articles" className="text-sm text-neutral-500 transition-colors hover:text-neutral-950 dark:hover:text-neutral-50">返回文章列表</Link>
        </header>

        <ArticleEditor
          article={{
            id: article.id,
            title: article.title,
            slug: article.slug,
            excerpt: article.excerpt,
            contentMarkdown: article.contentMarkdown,
            coverImage: article.coverImage,
            status: article.status,
            commentsMode: fromPrismaArticleCommentsMode(article.commentsMode),
            publishedAt: article.publishedAt,
            expiresAt: article.expiresAt,
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
      </div>
    )
  } catch {
    notFound()
  }
}
