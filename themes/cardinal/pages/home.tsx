import Link from 'next/link'
import type { Route } from 'next'

import { Pagination } from '@/components/pagination'
import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import type { HomePageData } from '@/lib/theme/page-types'
import { buildDynamicCss, getSettingString, isSettingTrue, getSidebarItems } from '../lib/settings-helpers'

type Article = HomePageData['articles'][number]

// --- 子组件 ---

function HeroSection({ settings }: { settings: Record<string, unknown> }) {
  const siteName = typeof settings.siteName === 'string' && settings.siteName ? settings.siteName : 'SeanBlog'
  const siteDescription = typeof settings.siteDescription === 'string' && settings.siteDescription ? settings.siteDescription : ''
  return (
    <section className="cf-hero border-b border-border px-[var(--layout-gap)] py-12 text-center">
      <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{siteName}</h1>
      {siteDescription && <p className="mt-3 text-sm text-text-secondary">{siteDescription}</p>}
    </section>
  )
}

function ArticleListItem({ article, listSeparator }: { article: Article; listSeparator: string }) {
  const separatorClass =
    listSeparator === 'border' ? 'border-b border-border py-6' :
    listSeparator === 'card' ? 'rounded-[var(--radius)] border border-border p-4' :
    'py-6'
  return (
    <Link
      href={`/articles/${article.slug}` as Route}
      className={`group block transition-colors hover:border-border-hover ${separatorClass}`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-base font-semibold transition-colors group-hover:text-accent">{article.title}</h2>
        {article.publishedAt && article.publishedAt instanceof Date && (
          <time dateTime={article.publishedAt.toISOString()} className="shrink-0 text-xs text-text-tertiary">
            {new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(article.publishedAt)}
          </time>
        )}
      </div>
      {article.excerpt && <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-text-secondary">{article.excerpt}</p>}
      <div className="mt-2 flex items-center gap-3 text-xs text-text-tertiary">
        {article.category && <span>{article.category.name}</span>}
        {article.tags.slice(0, 3).map((t) => (
          <span key={t.id}>#{t.name}</span>
        ))}
      </div>
    </Link>
  )
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
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
        <div className="mt-3 flex items-center gap-2 text-xs text-text-tertiary">
          {article.publishedAt && article.publishedAt instanceof Date && (
            <time>{new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(article.publishedAt)}</time>
          )}
          {article.category && <span>· {article.category.name}</span>}
        </div>
      </div>
    </Link>
  )
}

function ArticleList({ articles, settings }: { articles: Article[]; settings: Record<string, unknown> }) {
  const style = getSettingString(settings, 'articleListStyle', 'list')
  const separator = getSettingString(settings, 'listSeparator', 'border')

  if (style === 'cards') {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
      </div>
    )
  }

  return (
    <div>
      {articles.map((a) => <ArticleListItem key={a.id} article={a} listSeparator={separator} />)}
    </div>
  )
}

function SidebarContent({ items, sidebarData, settings }: {
  items: string[]
  sidebarData?: HomePageData['sidebarData']
  settings: Record<string, unknown>
}) {
  const siteName = typeof settings.siteName === 'string' && settings.siteName ? settings.siteName : 'SeanBlog'
  const siteDescription = typeof settings.siteDescription === 'string' && settings.siteDescription ? settings.siteDescription : ''

  return (
    <div className="space-y-6">
      {items.map((item) => {
        if (item === 'profile') {
          return (
            <div key="profile" className="rounded-[var(--radius)] bg-[var(--color-muted-bg)] p-4">
              <h3 className="text-sm font-bold">{siteName}</h3>
              {siteDescription && <p className="mt-2 text-xs leading-5 text-text-secondary">{siteDescription}</p>}
            </div>
          )
        }
        if (item === 'recent' && sidebarData?.recentArticles && sidebarData.recentArticles.length > 0) {
          return (
            <div key="recent" className="rounded-[var(--radius)] bg-[var(--color-muted-bg)] p-4">
              <h3 className="mb-3 text-sm font-bold">最近</h3>
              <ul className="space-y-1.5">
                {sidebarData.recentArticles.map((a) => (
                  <li key={a.id}>
                    <Link href={`/articles/${a.slug}` as Route} className="block truncate text-xs text-text-secondary transition-colors hover:text-accent">
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        }
        if (item === 'tags' && sidebarData?.tags && sidebarData.tags.length > 0) {
          return (
            <div key="tags" className="rounded-[var(--radius)] bg-[var(--color-muted-bg)] p-4">
              <h3 className="mb-3 text-sm font-bold">标签</h3>
              <div className="flex flex-wrap gap-1.5">
                {sidebarData.tags.map((t) => (
                  <Link key={t.id} href={`/tags/${t.slug}` as Route} className="rounded-[var(--radius-sm)] bg-[rgba(0,0,0,0.15)] px-2 py-0.5 text-xs text-text-secondary transition-colors hover:text-accent">
                    {t.name}
                  </Link>
                ))}
              </div>
            </div>
          )
        }
        if (item === 'categories' && sidebarData?.categories && sidebarData.categories.length > 0) {
          return (
            <div key="categories" className="rounded-[var(--radius)] bg-[var(--color-muted-bg)] p-4">
              <h3 className="mb-3 text-sm font-bold">分类</h3>
              <ul className="space-y-1.5">
                {sidebarData.categories.map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between text-xs">
                    <Link href={`/categories/${c.slug}` as Route} className="text-text-secondary transition-colors hover:text-accent">{c.name}</Link>
                    <span className="text-text-tertiary">{c._count.articles}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

// --- 主组件 ---

export default function CardinalHomePage({ data }: { data: HomePageData }) {
  const { articles, pinned, pagination, sort, sortOptions, settings, sidebarData } = data

  const sidebarPos = getSettingString(settings, 'sidebarPosition', 'right')
  const showHero = isSettingTrue(settings, 'showHeroSection')
  const showFeatured = isSettingTrue(settings, 'showFeaturedSection')
  const sidebarItems = getSidebarItems(settings)
  const hasSidebar = sidebarPos !== 'none'

  const sidebarEl = hasSidebar ? (
    <SidebarContent items={sidebarItems} sidebarData={sidebarData} settings={settings} />
  ) : null

  const layoutClass =
    sidebarPos === 'left' ? 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10' :
    sidebarPos === 'right' ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-10' :
    sidebarPos === 'both' ? 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)_15rem] lg:gap-8' :
    ''

  function pageHref(page: number): Route {
    const params = new URLSearchParams()
    if (page > 1) params.set('page', String(page))
    if (sort !== 'publishedAt') params.set('sort', sort)
    const query = params.toString()
    return (query ? `/?${query}` : '/') as Route
  }

  return (
    <>
      <style>{buildDynamicCss(settings)}</style>

      {showHero && <HeroSection settings={settings} />}

      <div className={`mx-auto max-w-[var(--layout-content-max-width)] px-4 py-8 ${layoutClass}`}>
        {/* 左侧栏 */}
        {sidebarPos === 'left' || sidebarPos === 'both' ? (
          <MobileSidebar side="left">{sidebarEl}</MobileSidebar>
        ) : null}

        {/* 主内容 */}
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
              {showFeatured ? '最新文章' : '文章'}
            </h1>
            <nav className="flex gap-3 text-xs">
              {sortOptions.map((option) => (
                <Link
                  key={option.value}
                  href={option.href}
                  className={`transition-colors ${option.value === sort ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary'}`}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
          </div>

          {showFeatured && pinned.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-bold text-text-secondary">精选</h2>
              <ArticleList articles={pinned} settings={settings} />
            </section>
          )}

          {articles.length > 0 ? (
            <ArticleList articles={articles} settings={settings} />
          ) : (
            <p className="py-12 text-center text-text-secondary">这里还没有文章。</p>
          )}

          <div className="mt-6">
            <Pagination currentPage={pagination.page} pageCount={pagination.pageCount} hrefForPage={pageHref} />
          </div>
        </div>

        {/* 右侧栏 */}
        {sidebarPos === 'right' || sidebarPos === 'both' ? (
          <MobileSidebar side="right">{sidebarEl}</MobileSidebar>
        ) : null}
      </div>
    </>
  )
}
