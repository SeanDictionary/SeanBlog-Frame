import Link from 'next/link'
import type { Route } from 'next'

import { Pagination } from '@/components/pagination'
import type { TaxonomyPageData } from '@/lib/theme/page-types'
import { buildDynamicCss, getSettingString } from '../lib/settings-helpers'

export default function CardinalTaxonomyPage({ data }: { data: TaxonomyPageData }) {
  const { taxonomy, articles, pagination, settings } = data

  function pageHref(page: number): Route {
    const base = taxonomy.type === 'category' ? 'categories' : 'tags'
    return (page === 1 ? `/${base}/${taxonomy.slug}` : `/${base}/${taxonomy.slug}?page=${page}`) as Route
  }

  const style = getSettingString(settings, 'articleListStyle', 'list')
  const separator = getSettingString(settings, 'listSeparator', 'border')

  return (
    <>
      <style>{buildDynamicCss(settings)}</style>
      <div className="mx-auto max-w-[var(--layout-content-max-width)] px-4 py-12">
        <header className="mb-8 border-b border-border pb-6">
          <p className="mb-1 text-xs text-text-tertiary">{taxonomy.type === 'category' ? '分类' : '标签'}</p>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{taxonomy.name}</h1>
          {taxonomy.description && <p className="mt-2 text-sm text-text-secondary">{taxonomy.description}</p>}
        </header>

        {articles.length > 0 ? (
          style === 'cards' ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articles/${article.slug}` as Route}
                  className="group block overflow-hidden rounded-[var(--radius)] border border-border transition-colors hover:border-border-hover"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  {article.coverImage && (
                    <div className="aspect-video overflow-hidden">
                      <img src={article.coverImage} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </div>
                  )}
                  <div className="p-4">
                    <h2 className="text-base font-semibold transition-colors group-hover:text-accent">{article.title}</h2>
                    {article.excerpt && <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{article.excerpt}</p>}
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
                    separator === 'card' ? 'rounded-[var(--radius)] border border-border p-4' : 'py-6'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="text-base font-semibold transition-colors group-hover:text-accent">{article.title}</h2>
                    {article.publishedAt && article.publishedAt instanceof Date && (
                      <time className="shrink-0 text-xs text-text-tertiary">
                        {new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(article.publishedAt)}
                      </time>
                    )}
                  </div>
                  {article.excerpt && <p className="mt-1.5 line-clamp-2 text-sm text-text-secondary">{article.excerpt}</p>}
                </Link>
              ))}
            </div>
          )
        ) : (
          <p className="py-12 text-center text-text-secondary">暂无文章。</p>
        )}

        <div className="mt-6">
          <Pagination currentPage={pagination.page} pageCount={pagination.pageCount} hrefForPage={pageHref} />
        </div>
      </div>
    </>
  )
}
