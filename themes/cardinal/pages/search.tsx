import Link from 'next/link'
import type { Route } from 'next'

import type { SearchPageData } from '@/lib/theme/page-types'
import { buildDynamicCss, getSettingString } from '../lib/settings-helpers'

export default function CardinalSearchPage({ data }: { data: SearchPageData }) {
  const { query, articles, pagination, settings } = data
  const { Pagination } = data.components
  const style = getSettingString(settings, 'articleListStyle', 'list')
  const separator = getSettingString(settings, 'listSeparator', 'border')

  function pageHref(page: number): Route {
    return (page === 1 ? `/search?q=${encodeURIComponent(query)}` : `/search?q=${encodeURIComponent(query)}&page=${page}`) as Route
  }

  return (
    <>
      <style>{buildDynamicCss(settings)}</style>
      <div className="flex justify-center px-4 py-12"><div className="w-(--layout-content-max-width)">
        <header className="mb-8 border-b border-border pb-6">
          <p className="mb-1 text-sm text-text-tertiary">搜索</p>
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>"{query}"</h1>
          <p className="mt-2 text-base text-text-tertiary">共 {pagination.total} 篇</p>
        </header>

        {articles.length > 0 ? (
          style === 'cards' ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articles/${article.slug}` as Route}
                  className="group block overflow-hidden rounded-(--radius) border border-border transition-colors hover:border-border-hover"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  {article.coverImage && (
                    <div className="aspect-video overflow-hidden">
                      <img src={article.coverImage} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="p-4">
                    <h2 className="text-lg font-semibold transition-colors group-hover:text-accent">{article.title}</h2>
                    {article.excerpt && <p className="mt-2 line-clamp-2 text-base text-text-secondary">{article.excerpt}</p>}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div>
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articles/${article.slug}` as Route}
                  className={`group block transition-colors hover:border-border-hover ${
                    separator === 'border' ? 'border-b border-border py-6' :
                    separator === 'card' ? 'rounded-(--radius) border border-border p-4' : 'py-6'
                  }`}
                >
                  <h2 className="text-lg font-semibold transition-colors group-hover:text-accent">{article.title}</h2>
                  {article.excerpt && <p className="mt-1.5 line-clamp-2 text-base text-text-secondary">{article.excerpt}</p>}
                </Link>
              ))}
            </div>
          )
        ) : (
          <p className="py-12 text-center text-text-secondary">没有找到相关文章。</p>
        )}

        <div className="mt-6">
          <Pagination currentPage={pagination.page} pageCount={pagination.pageCount} hrefForPage={pageHref} />
      </div></div></div>
    </>
  )
}
