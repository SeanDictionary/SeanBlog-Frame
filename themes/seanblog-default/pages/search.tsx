import type { Route } from 'next'
import type { ReactNode } from 'react'

import { ArticleCard } from '@/components/article/article-card'
import { Pagination } from '@/components/pagination'
import { HighlightedText } from '@/components/search/highlighted-text'

export default function DefaultSearchPage({ data }: { data: any }) {
  const { query, articles, pagination } = data

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
    const slots = ['search-box', 'search-results', 'pagination']

    return (
      <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 sm:py-18">
        {slots.map((slot) => <div key={slot}>{slotContent[slot]}</div>)}
      </div>
    )
  }

  const pageHref = (nextPage: number): Route => `/search?q=${encodeURIComponent(query)}&page=${nextPage}` as Route

  const slotContent: Record<string, ReactNode> = {
    'search-box': (
      <header className="mb-10 border-b border-border pb-8">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">搜索结果</p>
        <h1 className="text-4xl font-semibold tracking-[-0.045em]">“{query}”</h1>
        <p className="mt-3 text-text-secondary">找到 {pagination.total} 篇相关文章。</p>
      </header>
    ),
    'search-results': articles.length > 0 ? (
      <div>
        {articles.map((article: any) => (
          <ArticleCard
            key={article.id}
            article={article as any}
            renderTitle={(title: string) => <HighlightedText text={title} query={query} />}
            renderExcerpt={(excerpt: string) => <HighlightedText text={excerpt} query={query} />}
          />
        ))}
      </div>
    ) : (
      <p className="border-t border-border py-12 text-text-secondary">没有找到相关文章，试试换一个关键词。</p>
    ),
    pagination: <Pagination currentPage={pagination.page} pageCount={pagination.pageCount} hrefForPage={pageHref} />,
  }
  const slots = ['search-box', 'search-results', 'pagination']

  return (
    <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 sm:py-18">
      {slots.map((slot) => <div key={slot}>{slotContent[slot]}</div>)}
    </div>
  )
}
