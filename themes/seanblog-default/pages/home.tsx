import Link from 'next/link'
import type { Route } from 'next'

import type { HomePageData, ThemePage } from '@/lib/theme/page-types'

function pageHref(page: number, sort: string): Route {
  const params = new URLSearchParams()
  if (page > 1) params.set('page', String(page))
  if (sort !== 'publishedAt') params.set('sort', sort)
  const query = params.toString()
  return (query ? `/?${query}` : '/') as Route
}

function sortHref(sort: string): Route {
  return (sort === 'publishedAt' ? '/' : `/?sort=${sort}`) as Route
}

export default function DefaultHomePage({ data }: { data: HomePageData }) {
  const { articles, pinned, pagination, sort, sortOptions, settings } = data
  const { ArticleCard, Pagination } = data.components
  const siteName = typeof settings.siteName === 'string' ? settings.siteName : 'SeanBlog'
  const siteDescription = typeof settings.siteDescription === 'string' ? settings.siteDescription : ''
  const page = pagination.page
  const currentSortLabel = sortOptions.find((o) => o.value === sort)?.label ?? '发布时间'

  return (
    <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 sm:py-18">
      <header className="mb-14 border-b border-border pb-10">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">个人博客</p>
        <h1 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{siteName}</h1>
        {siteDescription && <p className="mt-4 max-w-2xl text-lg leading-8 text-text-secondary">{siteDescription}</p>}
      </header>

      {pinned.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 inline-flex items-center gap-1 text-xs text-accent">
            <i className="fa-solid fa-thumbtack text-[0.625rem]" aria-hidden="true" />
            置顶文章
          </div>
          <div>{pinned.map((article) => <ArticleCard key={article.id} article={article as any} priority />)}</div>
        </section>
      )}

      <section aria-labelledby="latest-articles-heading">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="latest-articles-heading" className="font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">
            {page === 1 ? currentSortLabel : `第 ${page} 页 · ${currentSortLabel}`}
          </h2>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-text-tertiary">
            <span>共 {pagination.total} 篇</span>
            <span aria-hidden="true">·</span>
            <nav className="flex flex-wrap items-center gap-2" aria-label="首页文章排序">
              {sortOptions.map((option) => (
                <Link
                  key={option.value}
                  href={option.value === sort ? sortHref(option.value) : sortHref(option.value)}
                  aria-current={option.value === sort ? 'true' : undefined}
                  className={`rounded-full border px-2.5 py-1 transition-colors ${
                    option.value === sort
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border hover:border-accent hover:text-accent'
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {articles.length > 0 ? (
          <div>{articles.map((article) => <ArticleCard key={article.id} article={article as any} priority={page === 1} />)}</div>
        ) : (
          <div className="border-border py-12 text-text-secondary">这里还没有文章。</div>
        )}
      </section>

      <Pagination
        currentPage={page}
        pageCount={pagination.pageCount}
        hrefForPage={(nextPage) => pageHref(nextPage, sort)}
      />
    </div>
  )
}
