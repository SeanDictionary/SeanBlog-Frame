import Link from 'next/link'
import type { Metadata } from 'next'
import type { Route } from 'next'
import type { ReactNode } from 'react'

import { ArticleCard } from '@/components/article/article-card'
import { Pagination } from '@/components/pagination'
import { listPublicArticles } from '@/lib/services/article-service'
import { listPublicCategories } from '@/lib/services/category-service'
import { getMergedSettings } from '@/lib/services/theme-settings-service'
import { listPublicTags } from '@/lib/services/tag-service'
import { normalizeThemeName, readThemeTemplate } from '@/lib/theme'
import { resolveThemePage } from '@/lib/theme/resolver'
import { getThemeComponents } from '@/lib/theme/components'
import { orderThemeSlots } from '@/lib/theme-slots'
import { publicArticleSortSchema, type PublicArticleSort } from '@/lib/validations/cms'

type HomePageProps = {
  searchParams: Promise<{ page?: string; sort?: string }>
}

const sortOptions = [
  { value: 'publishedAt', label: '发布时间', href: ('/' as Route) },
  { value: 'updatedAt', label: '更新时间', href: ('/?sort=updatedAt' as Route) },
  { value: 'viewCount', label: '浏览量', href: ('/?sort=viewCount' as Route) },
  { value: 'commentCount', label: '评论数', href: ('/?sort=commentCount' as Route) },
] satisfies Array<{ value: PublicArticleSort; label: string; href: Route }>

export const metadata: Metadata = {
  title: '首页',
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '1', 10)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

function parseSort(value: string | undefined): PublicArticleSort {
  const result = publicArticleSortSchema.safeParse(value)
  return result.success ? result.data : 'publishedAt'
}

function pageHref(page: number, sort: PublicArticleSort): Route {
  const params = new URLSearchParams()

  if (page > 1) {
    params.set('page', String(page))
  }

  if (sort !== 'publishedAt') {
    params.set('sort', sort)
  }

  const query = params.toString()
  return (query ? `/?${query}` : '/') as Route
}

function sortHref(sort: PublicArticleSort): Route {
  return (sort === 'publishedAt' ? '/' : `/?sort=${sort}`) as Route
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { page: pageParam, sort: sortParam } = await searchParams
  const page = parsePage(pageParam)
  const sort = parseSort(sortParam)
  const [settings, result] = await Promise.all([
    getMergedSettings(),
    listPublicArticles({ page, pageSize: 12, sort }),
  ])
  const template = await readThemeTemplate(normalizeThemeName(settings.activeTheme), 'home')

  const siteName = typeof settings.siteName === 'string' ? settings.siteName : 'SeanBlog'
  const siteDescription = typeof settings.siteDescription === 'string' ? settings.siteDescription : ''
  const pinned = page === 1 && sort === 'publishedAt' ? result.items.filter((article) => article.isPinned) : []
  const latest = page === 1 && sort === 'publishedAt' ? result.items.filter((article) => !article.isPinned) : result.items
  const currentSortLabel = sortOptions.find((option) => option.value === sort)?.label ?? '发布时间'
  const slotContent: Record<string, ReactNode> = {
    'site-intro': (
      <header className="mb-14 border-b border-border pb-10">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">个人博客</p>
        <h1 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{siteName}</h1>
        {siteDescription && <p className="mt-4 max-w-2xl text-lg leading-8 text-text-secondary">{siteDescription}</p>}
      </header>
    ),
    'pinned-articles': pinned.length > 0 ? (
      <section className="mb-12">
        <div className="mb-2 inline-flex items-center gap-1 text-xs text-accent">
          <i className="fa-solid fa-thumbtack text-[0.625rem]" aria-hidden="true" />
          置顶文章
        </div>
        <div>{pinned.map((article) => <ArticleCard key={article.id} article={article} priority />)}</div>
      </section>
    ) : null,
    'article-list': (
      <section aria-labelledby="latest-articles-heading">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="latest-articles-heading" className="font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">
            {page === 1 ? currentSortLabel : `第 ${page} 页 · ${currentSortLabel}`}
          </h2>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-text-tertiary">
            <span>共 {result.meta.total} 篇</span>
            <span aria-hidden="true">·</span>
            <nav className="flex flex-wrap items-center gap-2" aria-label="首页文章排序">
              {sortOptions.map((option) => (
                <Link
                  key={option.value}
                  href={sortHref(option.value)}
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

        {latest.length > 0 ? (
          <div>{latest.map((article) => <ArticleCard key={article.id} article={article} priority={page === 1} />)}</div>
        ) : (
          <div className="border-border py-12 text-text-secondary">这里还没有文章。</div>
        )}
      </section>
    ),
    pagination: <Pagination currentPage={result.meta.page} pageCount={result.meta.pageCount} hrefForPage={(nextPage) => pageHref(nextPage, sort)} />,
  }
  const slots = orderThemeSlots(['site-intro', 'pinned-articles', 'article-list', 'pagination'], template?.slots)

  // 主题页面解析器：如果活跃主题提供了 JSX 页面，使用它；否则走 slot 系统
  const themePage = await resolveThemePage(normalizeThemeName(settings.activeTheme), 'home')
  if (themePage) {
    // 加载侧边栏数据（如果主题使用了侧边栏）
    let sidebarData: { recentArticles: any[]; tags: any[]; categories: any[] } | undefined
    if (settings.sidebarPosition && settings.sidebarPosition !== 'none') {
      try {
        const [recentResult, tagsResult, catsResult] = await Promise.all([
          listPublicArticles({ page: 1, pageSize: 5, sort: 'publishedAt' }),
          listPublicTags({ page: 1, pageSize: 20 }),
          listPublicCategories({ page: 1, pageSize: 20 }),
        ])
        sidebarData = {
          recentArticles: recentResult.items.map((a) => ({ id: a.id, title: a.title, slug: a.slug, publishedAt: a.publishedAt })),
          tags: tagsResult.items.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
          categories: catsResult.items.map((c) => ({ id: c.id, name: c.name, slug: c.slug, _count: { articles: (c as any)._count?.articles ?? 0 } })),
        }
      } catch {}
    }
    const themePageData = {
      articles: latest,
      pinned,
      pagination: result.meta,
      sort,
      sortOptions,
      settings,
      sidebarData,
      components: getThemeComponents(),
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
