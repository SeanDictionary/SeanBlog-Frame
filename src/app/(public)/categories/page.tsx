import type { Metadata } from 'next'
import type { Route } from 'next'
import Link from 'next/link'

import { Pagination } from '@/components/pagination'
import { getMergedSettings } from '@/lib/services/theme-settings-service'
import { listPublicCategories } from '@/lib/services/category-service'
import { normalizeThemeName } from '@/lib/theme'
import { resolveThemePage } from '@/lib/theme/resolver'

type CategoriesPageProps = {
  searchParams: Promise<{ page?: string }>
}

export const metadata: Metadata = {
  title: '分类',
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '1', 10)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

function pageHref(page: number): Route {
  return (page === 1 ? '/categories' : `/categories?page=${page}`) as Route
}

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const { page: pageParam } = await searchParams
  const page = parsePage(pageParam)
  const [result, settings] = await Promise.all([
    listPublicCategories({ page, pageSize: 30 }),
    getMergedSettings(),
  ])

  const themePage = await resolveThemePage(normalizeThemeName(settings.activeTheme), 'categories-index')
  if (themePage) {
    const themePageData = {
      categories: result.items,
      pagination: result.meta,
      settings,
      components: {},
    } as any
    const ThemePageComponent = themePage
    return <ThemePageComponent data={themePageData} />
  }

  return (
    <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 sm:py-18">
      <header className="mb-10 border-b border-border pb-8">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">主题索引</p>
        <h1 className="text-4xl font-semibold tracking-[-0.045em]">分类</h1>
      </header>

      {result.items.length > 0 ? (
        <div className="grid gap-x-10 sm:grid-cols-2">
          {result.items.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="group border-t border-border py-6 first:border-t-0 sm:nth-[2]:border-t-0"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-xl font-semibold tracking-[-0.02em] transition-colors group-hover:text-accent">
                  {category.name}
                </h2>
                <span className="font-mono text-xs text-text-tertiary">{category._count.articles} 篇</span>
              </div>
              {category.description && <p className="mt-2 leading-7 text-text-secondary">{category.description}</p>}
            </Link>
          ))}
        </div>
      ) : (
        <p className="border-t border-border py-12 text-text-secondary">暂时没有可浏览的分类。</p>
      )}

      <Pagination currentPage={result.meta.page} pageCount={result.meta.pageCount} hrefForPage={pageHref} />
    </div>
  )
}
