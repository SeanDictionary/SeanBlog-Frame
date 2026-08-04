import { notFound } from 'next/navigation'
import type { Route } from 'next'

import { ArticleCard } from '@/components/article/article-card'
import { Pagination } from '@/components/pagination'
import { isDatabaseError } from '@/lib/database-errors'
import { listPublicArticles } from '@/lib/services/article-service'
import { getPublicTagBySlug } from '@/lib/services/tag-service'

type TagPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '1', 10)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const [{ slug }, { page: pageParam }] = await Promise.all([params, searchParams])
  const page = parsePage(pageParam)

  try {
    const [tag, result] = await Promise.all([
      getPublicTagBySlug(slug),
      listPublicArticles({ page, pageSize: 12, tag: slug }),
    ])

    const pageHref = (nextPage: number): Route => (nextPage === 1 ? `/tags/${slug}` : `/tags/${slug}?page=${nextPage}`) as Route

    return (
      <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 sm:py-18">
        <header className="mb-10 border-b border-border pb-8">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">标签 · {tag._count.articles} 篇文章</p>
          <h1 className="text-4xl font-semibold tracking-[-0.045em]">#{tag.name}</h1>
        </header>

        {result.items.length > 0 ? (
          <div>{result.items.map((article) => <ArticleCard key={article.id} article={article} />)}</div>
        ) : (
          <p className="border-t border-border py-12 text-text-secondary">这个标签还没有文章。</p>
        )}

        <Pagination currentPage={result.meta.page} pageCount={result.meta.pageCount} hrefForPage={pageHref} />
      </div>
    )
  } catch (error) {
    if (isDatabaseError(error)) throw error
    notFound()
  }
}
