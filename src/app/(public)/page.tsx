import type { Metadata } from 'next'
import type { Route } from 'next'

import { ArticleCard } from '@/components/article/article-card'
import { Pagination } from '@/components/pagination'
import { listPublicArticles } from '@/lib/services/article-service'
import { getSiteSettingsMap } from '@/lib/services/setting-service'

type HomePageProps = {
  searchParams: Promise<{ page?: string }>
}

export const metadata: Metadata = {
  title: '首页',
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '1', 10)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

function pageHref(page: number): Route {
  return (page === 1 ? '/' : `/?page=${page}`) as Route
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { page: pageParam } = await searchParams
  const page = parsePage(pageParam)
  const [settings, result] = await Promise.all([
    getSiteSettingsMap(),
    listPublicArticles({ page, pageSize: 12 }),
  ])

  const siteName = typeof settings.siteName === 'string' ? settings.siteName : 'SeanBlog'
  const siteDescription = typeof settings.siteDescription === 'string' ? settings.siteDescription : ''
  const pinned = page === 1 ? result.items.filter((article) => article.isPinned) : []
  const latest = page === 1 ? result.items.filter((article) => !article.isPinned) : result.items

  return (
    <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 sm:py-18">
      <header className="mb-14 border-b border-border pb-10">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">个人博客</p>
        <h1 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{siteName}</h1>
        {siteDescription && <p className="mt-4 max-w-2xl text-lg leading-8 text-text-secondary">{siteDescription}</p>}
      </header>

      {pinned.length > 0 && (
        <section className="mb-12">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-accent">置顶内容</p>
          <div>{pinned.map((article) => <ArticleCard key={article.id} article={article} pinned priority />)}</div>
        </section>
      )}

      <section aria-labelledby="latest-articles-heading">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="latest-articles-heading" className="font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">
            {page === 1 ? '最新文章' : `第 ${page} 页`}
          </h2>
          <span className="text-xs text-text-tertiary">共 {result.meta.total} 篇</span>
        </div>

        {latest.length > 0 ? (
          <div>{latest.map((article) => <ArticleCard key={article.id} article={article} priority={page === 1} />)}</div>
        ) : (
          <div className="border-t border-border py-12 text-text-secondary">这里还没有文章。</div>
        )}

        <Pagination currentPage={result.meta.page} pageCount={result.meta.pageCount} hrefForPage={pageHref} />
      </section>
    </div>
  )
}
