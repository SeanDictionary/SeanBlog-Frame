import { notFound } from 'next/navigation'
import type { Route } from 'next'

import { ArticleCard } from '@/components/article/article-card'
import { Pagination } from '@/components/pagination'
import { getPublicCategoryBySlug } from '@/lib/services/category-service'
import { listPublicArticles } from '@/lib/services/article-service'

type CategoryPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '1', 10)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, { page: pageParam }] = await Promise.all([params, searchParams])
  const page = parsePage(pageParam)

  try {
    const [category, result] = await Promise.all([
      getPublicCategoryBySlug(slug),
      listPublicArticles({ page, pageSize: 12, category: slug }),
    ])

    const pageHref = (nextPage: number): Route => (nextPage === 1 ? `/categories/${slug}` : `/categories/${slug}?page=${nextPage}`) as Route

    return (
      <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 sm:py-18">
        <header className="mb-10 border-b border-border pb-8">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">分类 · {category._count.articles} 篇文章</p>
          <h1 className="text-4xl font-semibold tracking-[-0.045em]">{category.name}</h1>
          {category.description && <p className="mt-4 max-w-2xl leading-7 text-text-secondary">{category.description}</p>}
        </header>

        {result.items.length > 0 ? (
          <div>{result.items.map((article) => <ArticleCard key={article.id} article={article} />)}</div>
        ) : (
          <p className="border-t border-border py-12 text-text-secondary">这个分类还没有文章。</p>
        )}

        <Pagination currentPage={result.meta.page} pageCount={result.meta.pageCount} hrefForPage={pageHref} />
      </div>
    )
  } catch {
    notFound()
  }
}
