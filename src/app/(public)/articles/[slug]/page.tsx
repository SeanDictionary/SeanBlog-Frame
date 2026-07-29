import { notFound } from 'next/navigation'

import { getPublicArticleBySlug } from '@/lib/services/article-service'

type ArticlePageProps = {
  params: Promise<{ slug: string }>
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params

  try {
    const article = await getPublicArticleBySlug(slug)

    return (
      <article className="mx-auto max-w-[var(--content-max-width)] px-[var(--content-padding)] py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">{article.title}</h1>
          {article.publishedAt && (
            <time className="mt-2 block text-sm text-text-tertiary" dateTime={article.publishedAt.toISOString()}>
              {article.publishedAt.toLocaleDateString('zh-CN')}
            </time>
          )}
        </header>
        <div
          className="article-content"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />
      </article>
    )
  } catch {
    notFound()
  }
}
