import { redirect } from 'next/navigation'
import type { Route } from 'next'
import type { ReactNode } from 'react'

import { ArticleContent } from '@/components/article/article-content'
import { ArticleMeta } from '@/components/article/article-meta'
import { ArticleNavigation } from '@/components/article/article-navigation'
import { ArticleToc } from '@/components/article/article-toc'
import { ArticleCard } from '@/components/article/article-card'
import { CommentList } from '@/components/comment/comment-list'
import { Pagination } from '@/components/pagination'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { fromPrismaArticleCommentsMode } from '@/lib/comment-settings'
import { countContentWordsFromHtml, estimateReadingMinutesFromHtml } from '@/lib/content/reading-time'
import { getAdminSession } from '@/lib/auth.utils'
import { listPublicArticles, getPublicArticleBySlug, getPublicArticleNavigation } from '@/lib/services/article-service'
import { getMergedSettings } from '@/lib/services/theme-settings-service'
import { normalizeThemeName, readThemeCss, readThemeManifest, readThemePart, readThemeTemplate } from '@/lib/theme'
import { orderThemeSlots } from '@/lib/theme-slots'
import { publicArticleSortSchema, type PublicArticleSort } from '@/lib/validations/cms'

type ThemePreviewPageProps = {
  searchParams: Promise<{ theme?: string; page?: string; slug?: string; sort?: string }>
}

const sortOptions = [
  { value: 'publishedAt', label: '发布时间' },
  { value: 'updatedAt', label: '更新时间' },
  { value: 'viewCount', label: '浏览量' },
  { value: 'commentCount', label: '评论数' },
] satisfies Array<{ value: PublicArticleSort; label: string }>

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function slugifyHeading(value: string) {
  return stripHtml(value)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/[\s-]+/g, '-')
}

function getHeadings(html: string) {
  const headings: Array<{ id: string; text: string; level: number }> = []
  const usedIds = new Map<string, number>()
  const headingPattern = /<h([2-4])>([\s\S]*?)<\/h\1>/g

  const contentHtml = html.replace(headingPattern, (_match, rawLevel: string, content: string) => {
    const text = stripHtml(content)
    const baseId = slugifyHeading(text) || 'section'
    const count = usedIds.get(baseId) ?? 0
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`

    usedIds.set(baseId, count + 1)
    headings.push({ id, text, level: Number(rawLevel) })

    return `<h${rawLevel} id="${id}">${content}</h${rawLevel}>`
  })

  return { contentHtml, headings }
}

function sortHref(themeSlug: string, sort: PublicArticleSort): Route {
  const params = new URLSearchParams({ theme: themeSlug, page: 'home' })
  if (sort !== 'publishedAt') params.set('sort', sort)
  return `/theme-preview?${params.toString()}` as Route
}

function parseSort(value: string | undefined): PublicArticleSort {
  const result = publicArticleSortSchema.safeParse(value)
  return result.success ? result.data : 'publishedAt'
}

async function buildThemeOptionsCss(themeSlug: string, settings: Record<string, unknown>) {
  const manifest = await readThemeManifest(themeSlug).catch(() => null)
  const schema = manifest?.settingsSchema
  if (!schema) return null
  const items = Object.values(schema).flat()
  if (!items.length) return null

  const variables = items
    .map((item) => {
      if (!item.cssVariable) return null
      const value = settings[item.key] ?? item.default
      if (typeof value !== 'string' && typeof value !== 'number') return null
      return `${item.cssVariable}: ${value}`
    })
    .filter((item): item is string => item !== null)

  return variables.length ? `:root{${variables.join(';')}}` : null
}

async function renderPreviewHome(themeSlug: string, settings: Record<string, unknown>, sort: PublicArticleSort) {
  const result = await listPublicArticles({ page: 1, pageSize: 12, sort })
  const template = await readThemeTemplate(themeSlug, 'home')
  const siteName = typeof settings.siteName === 'string' ? settings.siteName : 'SeanBlog'
  const siteDescription = typeof settings.siteDescription === 'string' ? settings.siteDescription : ''
  const pinned = sort === 'publishedAt' ? result.items.filter((article) => article.isPinned) : []
  const latest = sort === 'publishedAt' ? result.items.filter((article) => !article.isPinned) : result.items
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
          <h2 id="latest-articles-heading" className="font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">{currentSortLabel}</h2>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-text-tertiary">
            <span>共 {result.meta.total} 篇</span>
            <span aria-hidden="true">·</span>
            <nav className="flex flex-wrap items-center gap-2" aria-label="首页文章排序">
              {sortOptions.map((option) => (
                <a key={option.value} href={sortHref(themeSlug, option.value)} aria-current={option.value === sort ? 'true' : undefined} className={`rounded-full border px-2.5 py-1 transition-colors ${option.value === sort ? 'border-accent bg-accent/10 text-accent' : 'border-border hover:border-accent hover:text-accent'}`}>{option.label}</a>
              ))}
            </nav>
          </div>
        </div>
        {latest.length > 0 ? <div>{latest.map((article) => <ArticleCard key={article.id} article={article} priority />)}</div> : <div className="border-border py-12 text-text-secondary">这里还没有文章。</div>}
      </section>
    ),
    pagination: <Pagination currentPage={result.meta.page} pageCount={result.meta.pageCount} hrefForPage={() => `/theme-preview?theme=${encodeURIComponent(themeSlug)}&page=home` as Route} />,
  }
  const slots = orderThemeSlots(['site-intro', 'pinned-articles', 'article-list', 'pagination'], template?.slots)

  return <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 sm:py-18">{slots.map((slot) => <div key={slot}>{slotContent[slot]}</div>)}</div>
}

async function renderPreviewArticle(themeSlug: string, settings: Record<string, unknown>, requestedSlug?: string) {
  const fallback = await listPublicArticles({ page: 1, pageSize: 1, sort: 'publishedAt' })
  const slug = requestedSlug ?? fallback.items[0]?.slug

  if (!slug) {
    return <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 text-text-secondary sm:py-18">暂无可预览的已发布文章。</div>
  }

  const [article, navigation] = await Promise.all([
    getPublicArticleBySlug(slug),
    getPublicArticleNavigation(slug),
  ])
  const template = await readThemeTemplate(themeSlug, 'articleDetail')
  const { contentHtml, headings } = getHeadings(article.contentHtml)
  const commentsMode = fromPrismaArticleCommentsMode(article.commentsMode)
  const readingMinutes = estimateReadingMinutesFromHtml(contentHtml)
  const wordCount = countContentWordsFromHtml(contentHtml)
  const slotContent: Record<string, ReactNode> = {
    'article-header': (
      <header className="mb-10 border-b border-border pb-9">
        <div className="mb-5 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">文章</div>
        <h1 className="text-4xl font-semibold leading-[1.15] tracking-[-0.045em] sm:text-5xl">{article.title}</h1>
        <div className="mt-6">
          <ArticleMeta
            publishedAt={article.publishedAt}
            category={article.category}
            tags={article.tags}
            viewCount={article.viewCount}
            readingMinutes={readingMinutes}
            wordCount={wordCount}
          />
        </div>
        {article.coverImage && <img src={article.coverImage} alt="" className="mt-8 aspect-video w-full rounded-(--radius) border border-border object-cover" />}
      </header>
    ),
    'article-content': <ArticleContent html={contentHtml} />,
    'article-navigation': <ArticleNavigation previous={navigation.previous} next={navigation.next} />,
    comments: <CommentList articleId={article.id} comments={article.comments} mode={commentsMode} />,
    toc: <ArticleToc headings={headings} />,
  }
  const slots = orderThemeSlots(['article-header', 'article-content', 'article-navigation', 'comments', 'toc'], template?.slots)

  return (
    <div className="mx-auto max-w-6xl px-(--content-padding) py-12 sm:py-18">
      <div className="relative">
        <article className="mx-auto w-full max-w-(--content-max-width) min-w-0">
          {slots.filter((slot) => slot !== 'toc').map((slot) => <div key={slot}>{slotContent[slot]}</div>)}
        </article>
        {slots.includes('toc') && slotContent.toc}
      </div>
    </div>
  )
}

export default async function ThemePreviewPage({ searchParams }: ThemePreviewPageProps) {
  const [session, params, settings] = await Promise.all([getAdminSession(), searchParams, getMergedSettings()])

  if (!session) {
    redirect('/login')
  }

  const themeSlug = normalizeThemeName(params.theme)
  const page = params.page === 'article' ? 'article' : 'home'
  const [themeCss, optionsCss, headerPart, footerPart] = await Promise.all([
    readThemeCss(themeSlug),
    buildThemeOptionsCss(themeSlug, settings),
    readThemePart(themeSlug, 'header'),
    readThemePart(themeSlug, 'footer'),
  ])
  const showHeader = headerPart?.blocks?.includes('SiteHeader') ?? true
  const showFooter = footerPart?.blocks?.includes('SiteFooter') ?? true
  const content = page === 'article'
    ? await renderPreviewArticle(themeSlug, settings, params.slug)
    : await renderPreviewHome(themeSlug, settings, parseSort(params.sort))

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      {themeCss && <style>{themeCss}</style>}
      {optionsCss && <style>{optionsCss}</style>}
      {showHeader && <SiteHeader settings={settings} />}
      <main className="flex-1">{content}</main>
      {showFooter && <SiteFooter settings={settings} />}
    </div>
  )
}
