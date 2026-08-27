import Link from 'next/link'
import type { Route } from 'next'

import { Pagination } from '@/components/pagination'
import type { CategoriesIndexPageData } from '@/lib/theme/page-types'
import { buildDynamicCss, getSettingString } from '../lib/settings-helpers'

export default function CardinalCategoriesIndexPage({ data }: { data: CategoriesIndexPageData }) {
  const { categories, pagination, settings } = data
  const style = getSettingString(settings, 'articleListStyle', 'list')

  function pageHref(page: number): Route {
    return (page === 1 ? '/categories' : `/categories?page=${page}`) as Route
  }

  return (
    <>
      <style>{buildDynamicCss(settings)}</style>
      <div className="flex justify-center px-4 py-12"><div className="w-[var(--layout-content-max-width)]">
        <header className="mb-8 border-b border-border pb-6">
          <p className="mb-1 text-sm text-text-tertiary">索引</p>
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>分类</h1>
        </header>

        {style === 'cards' ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}` as Route}
                className="group block rounded-[var(--radius)] border border-border p-5 transition-colors hover:border-border-hover"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <h2 className="text-xl font-semibold transition-colors group-hover:text-accent">{cat.name}</h2>
                {cat.description && <p className="mt-2 text-base text-text-secondary">{cat.description}</p>}
                <p className="mt-3 text-sm text-text-tertiary">{cat._count.articles} 篇文章</p>
              </Link>
            ))}
          </div>
        ) : (
          <div>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}` as Route}
                className="group flex items-baseline justify-between gap-4 border-b border-border py-5 transition-colors hover:border-border-hover"
              >
                <h2 className="text-lg font-semibold transition-colors group-hover:text-accent">{cat.name}</h2>
                <span className="text-sm text-text-tertiary">{cat._count.articles}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Pagination currentPage={pagination.page} pageCount={pagination.pageCount} hrefForPage={pageHref} />
      </div></div></div>
    </>
  )
}
