/**
 * 模板上下文构建：把平台 service 数据映射为 Handlebars ctx。
 * 主题只消费此 ctx，不接触数据源。
 */

import type { Route } from 'next'

import { fromPrismaArticleCommentsMode } from '@/lib/comment-settings'
import { countContentWordsFromHtml, estimateReadingMinutesFromHtml } from '@/lib/content/reading-time'
import { getPublicArticleBySlug, getPublicArticleNavigation, listPublicArticles, searchArticles } from '@/lib/services/article-service'
import { getPublicCategoryBySlug, listPublicCategories } from '@/lib/services/category-service'
import { getMergedSettings } from '@/lib/services/theme-settings-service'
import { getPublicTagBySlug, listPublicTags } from '@/lib/services/tag-service'

export type SiteCtx = {
  title: string
  description: string
  url: string
  locale: string
  logo?: string | null
}

export type SeoCtx = {
  title: string
  description?: string
  canonical?: string
  robots?: string
  og?: Record<string, string>
  jsonld?: unknown
}

export type PaginationCtx = {
  page: number
  pageCount: number
  total: number
  prevUrl?: string
  nextUrl?: string
  pages: Array<{ page: number; url: string; active: boolean }>
}

const HEADING_PATTERN = /<h([2-4])[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/h\1>/gi

function getHeadings(html: string) {
  const headings: Array<{ id: string; text: string; level: number }> = []
  const used = new Map<string, number>()
  const contentHtml = html.replace(HEADING_PATTERN, (m, lvl: string, id: string, inner: string) => {
    const text = inner.replace(/<[^>]*>/g, '').trim()
    if (id && text) headings.push({ id, text, level: Number(lvl) })
    return m
  })
  return { contentHtml, headings }
}

function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function buildPagination(basePath: string, page: number, pageCount: number, total: number, params: Record<string, string | undefined> = {}): PaginationCtx {
  const pages: PaginationCtx['pages'] = []
  for (let p = 1; p <= pageCount; p++) {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') sp.set(k, v)
    if (p > 1) sp.set('page', String(p))
    const q = sp.toString()
    pages.push({ page: p, url: q ? `${basePath}?${q}` : basePath, active: p === page })
  }
  const pageUrl = (p: number) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') sp.set(k, v)
    if (p > 1) sp.set('page', String(p))
    const q = sp.toString()
    return q ? `${basePath}?${q}` : basePath
  }
  return {
    page,
    pageCount,
    total,
    prevUrl: page > 1 ? pageUrl(page - 1) : undefined,
    nextUrl: page < pageCount ? pageUrl(page + 1) : undefined,
    pages,
  }
}

async function baseCtx(): Promise<{ settings: Record<string, unknown>; site: SiteCtx; theme: { slug: string; config: Record<string, unknown> } }> {
  const settings = await getMergedSettings()
  const site: SiteCtx = {
    title: typeof settings.siteName === 'string' && settings.siteName.trim() ? settings.siteName : 'SeanBlog',
    description: typeof settings.siteDescription === 'string' ? settings.siteDescription : '',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    locale: 'zh-CN',
    logo: typeof settings.siteLogo === 'string' ? settings.siteLogo : null,
  }
  const themeSlug = typeof settings.activeTheme === 'string' && settings.activeTheme !== 'default' ? settings.activeTheme : 'seanblog-default'
  return { settings, site, theme: { slug: themeSlug, config: settings as Record<string, unknown> } }
}

// --- 各页面 ctx 构建 ---

export async function buildHomeCtx(searchParams: { page?: string; sort?: string }) {
  const base = await baseCtx()
  const page = parsePage(searchParams.page)
  const sort = (searchParams.sort ?? 'publishedAt') as any
  const result = await listPublicArticles({ page, pageSize: 12, sort })
  const pinned = page === 1 && sort === 'publishedAt' ? result.items.filter((a: any) => a.isPinned) : []
  const latest = page === 1 && sort === 'publishedAt' ? result.items.filter((a: any) => !a.isPinned) : result.items

  return {
    ...base,
    page: 'home',
    posts: latest.map(normalizePost),
    pinned: pinned.map(normalizePost),
    pagination: buildPagination('/', page, result.meta.pageCount, result.meta.total, { sort: sort !== 'publishedAt' ? sort : undefined }),
    sort,
    sortOptions: [
      { value: 'publishedAt', label: '发布时间', href: '/' },
      { value: 'updatedAt', label: '更新时间', href: '/?sort=updatedAt' },
      { value: 'viewCount', label: '浏览量', href: '/?sort=viewCount' },
      { value: 'commentCount', label: '评论数', href: '/?sort=commentCount' },
    ],
    seo: {
      title: base.site.title,
      description: base.site.description,
      canonical: `${base.site.url}/`,
      og: { 'og:type': 'website', 'og:title': base.site.title, 'og:description': base.site.description },
    } as SeoCtx,
  }
}

export async function buildPostCtx(slug: string) {
  const base = await baseCtx()
  const [article, navigation] = await Promise.all([
    getPublicArticleBySlug(slug),
    getPublicArticleNavigation(slug),
  ])
  const a = article as any
  const { contentHtml, headings } = getHeadings(a.contentHtml)
  const readingMinutes = estimateReadingMinutesFromHtml(contentHtml)
  const wordCount = countContentWordsFromHtml(contentHtml)
  const commentsMode = fromPrismaArticleCommentsMode(a.commentsMode)

  return {
    ...base,
    page: 'post',
    post: {
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      coverImage: a.coverImage,
      publishedAt: a.publishedAt,
      updatedAt: a.updatedAt,
      viewCount: a.viewCount,
      category: a.category,
      tags: (a.tags ?? []).map((t: any) => ({ id: t.id ?? t.tag?.id, name: t.name ?? t.tag?.name, slug: t.slug ?? t.tag?.slug, description: t.description ?? t.tag?.description })),
      readingMinutes,
      wordCount,
    },
    content: contentHtml,
    toc: headings,
    navigation,
    comments: (a.comments ?? []).map(normalizeComment),
    commentsMode,
    seo: {
      title: a.metaTitle || a.title,
      description: a.metaDescription || stripHtml(a.excerpt || contentHtml).slice(0, 160),
      canonical: `${base.site.url}/articles/${a.slug}`,
      og: { 'og:type': 'article', 'og:title': a.metaTitle || a.title, 'og:description': a.metaDescription || '' },
      jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: a.title, datePublished: a.publishedAt?.toISOString() },
    } as SeoCtx,
  }
}

export async function buildTaxonomyCtx(type: 'category' | 'tag', slug: string, searchParams: { page?: string }) {
  const base = await baseCtx()
  const page = parsePage(searchParams.page)
  const info = type === 'category' ? await getPublicCategoryBySlug(slug) : await getPublicTagBySlug(slug)
  const result = await listPublicArticles({ page, pageSize: 12, [type]: slug } as any)
  const basePath = type === 'category' ? `/categories/${slug}` : `/tags/${slug}`
  return {
    ...base,
    page: 'taxonomy',
    taxonomy: { name: info.name, slug: info.slug, description: info.description ?? null, type },
    posts: result.items.map(normalizePost),
    pagination: buildPagination(basePath, page, result.meta.pageCount, result.meta.total),
    seo: { title: info.name, description: info.description ?? '', canonical: `${base.site.url}${basePath}` } as SeoCtx,
  }
}

export async function buildCategoriesIndexCtx(searchParams: { page?: string }) {
  const base = await baseCtx()
  const page = parsePage(searchParams.page)
  const result = await listPublicCategories({ page, pageSize: 30 })
  return {
    ...base,
    page: 'categories',
    categories: result.items,
    pagination: buildPagination('/categories', page, result.meta.pageCount, result.meta.total),
    seo: { title: '分类', canonical: `${base.site.url}/categories` } as SeoCtx,
  }
}

export async function buildTagsIndexCtx(searchParams: { page?: string }) {
  const base = await baseCtx()
  const page = parsePage(searchParams.page)
  const result = await listPublicTags({ page, pageSize: 50 })
  return {
    ...base,
    page: 'tags',
    tags: result.items,
    pagination: buildPagination('/tags', page, result.meta.pageCount, result.meta.total),
    seo: { title: '标签', canonical: `${base.site.url}/tags` } as SeoCtx,
  }
}

export async function buildSearchCtx(query: string, searchParams: { page?: string }) {
  const base = await baseCtx()
  const page = parsePage(searchParams.page)
  const result = await searchArticles({ q: query, page, pageSize: 12 })
  return {
    ...base,
    page: 'search',
    query,
    posts: result.items.map(normalizePost),
    pagination: buildPagination('/search', page, result.meta.pageCount, result.meta.total, { q: query }),
    seo: { title: `搜索：${query}`, canonical: `${base.site.url}/search?q=${encodeURIComponent(query)}` } as SeoCtx,
  }
}

// --- 归一化 ---

function normalizePost(a: any) {
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    coverImage: a.coverImage,
    isPinned: a.isPinned,
    publishedAt: a.publishedAt,
    updatedAt: a.updatedAt,
    viewCount: a.viewCount,
    commentCount: a._count?.comments ?? 0,
    category: a.category,
    tags: (a.tags ?? []).map((t: any) => ({ id: t.id ?? t.tag?.id, name: t.name ?? t.tag?.name, slug: t.slug ?? t.tag?.slug })),
    url: `/articles/${a.slug}` as Route,
  }
}

function normalizeComment(c: any) {
  return {
    id: c.id,
    content: c.content,
    author: c.guestName || '匿名',
    link: c.guestLink,
    createdAt: c.createdAt,
    replies: (c.replies ?? []).map(normalizeComment),
  }
}

function parsePage(v: string | undefined) {
  const n = Number.parseInt(v ?? '1', 10)
  return Number.isSafeInteger(n) && n > 0 ? n : 1
}
