import type { Metadata } from 'next'
import type { Route } from 'next'
import type { ReactNode } from 'react'

import { ArticleCard } from '@/components/article/article-card'
import { Pagination } from '@/components/pagination'
import { HighlightedText } from '@/components/search/highlighted-text'
import { searchArticles } from '@/lib/services/article-service'
import { getMergedSettings } from '@/lib/services/theme-settings-service'
import { normalizeThemeName, readThemeTemplate } from '@/lib/theme'
import { resolveThemePage } from '@/lib/theme/resolver'
import { orderThemeSlots } from '@/lib/theme-slots'

type SearchPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>
}

export const metadata: Metadata = {
  title: '搜索',
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '1', 10)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q: queryParam, page: pageParam } = await searchParams
  const query = queryParam?.trim() ?? ''
  const page = parsePage(pageParam)
  const settings = await getMergedSettings()
  const template = await readThemeTemplate(normalizeThemeName(settings.activeTheme), 'search')

  if (!query) {
    const slotContent: Record<string, ReactNode> = {
      'search-box': (
        <>
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">搜索</p>
          <h1 className="text-4xl font-semibold tracking-[-0.045em]">查找文章</h1>
          <p className="mt-4 text-text-secondary">使用顶部导航的搜索按钮，或按 <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-xs">⌘K</kbd> 输入关键词。</p>
        </>
      ),
      'search-results': null,
      pagination: null,
    }
    const slots = orderThemeSlots(['search-box', 'search-results', 'pagination'], template?.slots)

    return <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 sm:py-18">{slots.map((slot) => <div key={slot}>{slotContent[slot]}</div>)}</div>
  }

  const result = await searchArticles({ q: query, page, pageSize: 12 })
  const pageHref = (nextPage: number): Route => `/search?q=${encodeURIComponent(query)}&page=${nextPage}` as Route
  const slotContent: Record<string, ReactNode> = {
    'search-box': (
      <header className="mb-10 border-b border-border pb-8">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">搜索结果</p>
        <h1 className="text-4xl font-semibold tracking-[-0.045em]">“{query}”</h1>
        <p className="mt-3 text-text-secondary">找到 {result.meta.total} 篇相关文章。</p>
      </header>
    ),
    'search-results': result.items.length > 0 ? (
      <div>
        {result.items.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            renderTitle={(title) => <HighlightedText text={title} query={query} />}
            renderExcerpt={(excerpt) => <HighlightedText text={excerpt} query={query} />}
          />
        ))}
      </div>
    ) : (
      <p className="border-t border-border py-12 text-text-secondary">没有找到相关文章，试试换一个关键词。</p>
    ),
    pagination: <Pagination currentPage={result.meta.page} pageCount={result.meta.pageCount} hrefForPage={pageHref} />,
  }
  const slots = orderThemeSlots(['search-box', 'search-results', 'pagination'], template?.slots)

  const themePage = await resolveThemePage(normalizeThemeName(settings.activeTheme), 'search')
  if (themePage) {
    const themePageData = {
      query,
      articles: result.items,
      pagination: result.meta,
      settings,
      components: {},
    } as any
    const ThemePageComponent = themePage
    return <ThemePageComponent data={themePageData} />
  }

  return (
    <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 sm:py-18">
      {slots.map((slot) => <div key={slot}>{slotContent[slot]}</div>)}
    </div>
  )
}
