import type { Metadata } from 'next'
import type { Route } from 'next'
import Link from 'next/link'

import { Pagination } from '@/components/pagination'
import { getMergedSettings } from '@/lib/services/theme-settings-service'
import { listPublicTags } from '@/lib/services/tag-service'
import { normalizeThemeName } from '@/lib/theme'
import { resolveThemePage } from '@/lib/theme/resolver'
import { getThemeComponents } from '@/lib/theme/components'

type TagsPageProps = {
  searchParams: Promise<{ page?: string }>
}

export const metadata: Metadata = {
  title: '标签',
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '1', 10)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

function pageHref(page: number): Route {
  return (page === 1 ? '/tags' : `/tags?page=${page}`) as Route
}

export default async function TagsPage({ searchParams }: TagsPageProps) {
  const { page: pageParam } = await searchParams
  const page = parsePage(pageParam)
  const [result, settings] = await Promise.all([
    listPublicTags({ page, pageSize: 50 }),
    getMergedSettings(),
  ])

  const themePage = await resolveThemePage(normalizeThemeName(settings.activeTheme), 'tags-index')
  if (themePage) {
    const themePageData = {
      tags: result.items,
      pagination: result.meta,
      settings,
      components: getThemeComponents(),
    } as any
    const ThemePageComponent = themePage
    return <ThemePageComponent data={themePageData} />
  }

  return (
    <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 sm:py-18">
      <header className="mb-10 border-b border-border pb-8">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">关键词索引</p>
        <h1 className="text-4xl font-semibold tracking-[-0.045em]">标签</h1>
      </header>

      {result.items.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {result.items.map((tag) => (
            <Link
              key={tag.id}
              href={`/tags/${tag.slug}`}
              className="group inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm transition-colors hover:border-accent hover:bg-accent-subtle"
            >
              <span className="group-hover:text-accent">#{tag.name}</span>
              <span className="font-mono text-xs text-text-tertiary">{tag._count.articles}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="border-t border-border py-12 text-text-secondary">暂时没有可浏览的标签。</p>
      )}

      <Pagination currentPage={result.meta.page} pageCount={result.meta.pageCount} hrefForPage={pageHref} />
    </div>
  )
}
