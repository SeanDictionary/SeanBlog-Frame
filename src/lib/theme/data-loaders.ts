/**
 * 数据加载器 — 核心层负责所有数据获取和预处理。
 * 主题页面组件通过 page-types.ts 的类型接收这些数据。
 *
 * 这些函数从 service 层获取原始数据，做预处理（TOC 提取、阅读时间、
 * 元信息显隐设置等），返回完整的 PageData。
 */

import { fromPrismaArticleCommentsMode } from '@/lib/comment-settings'
import { countContentWordsFromHtml, estimateReadingMinutesFromHtml } from '@/lib/content/reading-time'
import type { Route } from 'next'
import { listPublicArticles, getPublicArticleBySlug, getPublicArticleNavigation, searchArticles } from '@/lib/services/article-service'
import { getPublicCategoryBySlug, listPublicCategories } from '@/lib/services/category-service'
import { getMergedSettings } from '@/lib/services/theme-settings-service'
import { listPublicTags } from '@/lib/services/tag-service'
import type {
  ArticleDetailPageData,
  CategoriesIndexPageData,
  HomePageData,
  SearchPageData,
  TagsIndexPageData,
  TaxonomyPageData,
  ThemeComponents,
  TocItem,
} from './page-types'
import type { PublicArticleSort } from '@/lib/validations/cms'

// --- 辅助函数 ---

function parsePage(value: string | undefined, fallback = 1) {
  const page = Number.parseInt(value ?? String(fallback), 10)
  return Number.isSafeInteger(page) && page > 0 ? page : fallback
}

const HEADING_PATTERN = /<h([2-4])[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/h\1>/gi

function getHeadings(html: string): { contentHtml: string; headings: TocItem[] } {
  const headings: TocItem[] = []
  const contentHtml = html.replace(HEADING_PATTERN, (_match, rawLevel: string, id: string, content: string) => {
    const level = Number.parseInt(rawLevel, 10)
    const text = content.replace(/<[^>]*>/g, '').trim()
    if (id && text) {
      headings.push({ id, text, level })
    }
    return _match
  })
  return { contentHtml, headings }
}

function normalizeMetaOrder(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  return ['publishedAt', 'viewCount', 'readingTime', 'wordCount', 'category', 'tags']
}

function pageHrefBuilder(basePath: string, params: Record<string, string | undefined>, page: number): Route {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page') search.set(key, value)
  }
  if (page > 1) search.set('page', String(page))
  const query = search.toString()
  return (query ? `${basePath}?${query}` : basePath) as Route
}

// --- 加载器 ---

export async function loadHomePageData(
  searchParams: { page?: string; sort?: string },
  components: ThemeComponents,
): Promise<HomePageData> {
  const settings = await getMergedSettings()
  const page = parsePage(searchParams.page)
  const sort = (searchParams.sort ?? 'publishedAt') as PublicArticleSort

  const sortOptions: HomePageData['sortOptions'] = [
    { value: 'publishedAt', label: '发布时间', href: ('/' as Route) },
    { value: 'updatedAt', label: '更新时间', href: ('/?sort=updatedAt' as Route) },
    { value: 'viewCount', label: '浏览量', href: ('/?sort=viewCount' as Route) },
    { value: 'commentCount', label: '评论数', href: ('/?sort=commentCount' as Route) },
  ]

  const result = await listPublicArticles({ page, pageSize: 12, sort })
  const pinned = page === 1 && sort === 'publishedAt' ? result.items.filter((a) => a.isPinned) : []
  const latest = page === 1 && sort === 'publishedAt' ? result.items.filter((a) => !a.isPinned) : result.items

  return {
    articles: latest as HomePageData['articles'],
    pinned: pinned as HomePageData['articles'],
    pagination: result.meta,
    sort,
    sortOptions,
    settings,
    components,
  }
}

export async function loadArticleDetailData(
  slug: string,
  components: ThemeComponents,
): Promise<ArticleDetailPageData> {
  const [article, settings, navigation] = await Promise.all([
    getPublicArticleBySlug(slug),
    getMergedSettings(),
    getPublicArticleNavigation(slug),
  ])

  const { contentHtml, headings } = getHeadings(article.contentHtml)
  const readingMinutes = estimateReadingMinutesFromHtml(contentHtml)
  const wordCount = countContentWordsFromHtml(contentHtml)
  const commentsMode = fromPrismaArticleCommentsMode(article.commentsMode)

  const metaVisibility: ArticleDetailPageData['metaVisibility'] = {
    showPublishedAt: settings.articleMetaShowPublishedAt !== false,
    showViewCount: settings.articleMetaShowViewCount !== false,
    showReadingTime: settings.articleMetaShowReadingTime !== false,
    showWordCount: settings.articleMetaShowWordCount !== false,
    showCategory: settings.articleMetaShowCategory !== false,
    showTags: settings.articleMetaShowTags !== false,
    order: normalizeMetaOrder(settings.articleMetaOrder),
  }

  return {
    article: {
      id: article.id,
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      coverImage: article.coverImage,
      publishedAt: article.publishedAt,
      updatedAt: (article as any).updatedAt ?? null,
      viewCount: article.viewCount,
      visitorCount: (article as any).visitorCount ?? 0,
      metaTitle: article.metaTitle,
      metaDescription: article.metaDescription,
      metaKeywords: article.metaKeywords,
      category: article.category as ArticleDetailPageData['article']['category'],
      tags: article.tags as ArticleDetailPageData['article']['tags'],
    },
    contentHtml,
    toc: headings,
    readingMinutes,
    wordCount,
    commentsMode,
    navigation,
    comments: (article.comments ?? []) as unknown as ArticleDetailPageData['comments'],
    metaVisibility,
    settings,
    components,
  }
}

export async function loadTaxonomyData(
  type: 'category' | 'tag',
  slug: string,
  searchParams: { page?: string },
  components: ThemeComponents,
): Promise<TaxonomyPageData> {
  const settings = await getMergedSettings()
  const page = parsePage(searchParams.page)

  const taxonomyInfo = type === 'category'
    ? await getPublicCategoryBySlug(slug)
    : await getPublicCategoryBySlug(slug) // TODO: replace with getPublicTagBySlug

  const result = await listPublicArticles({ page, pageSize: 12, [type]: slug })

  return {
    taxonomy: {
      name: taxonomyInfo.name,
      slug: taxonomyInfo.slug,
      description: taxonomyInfo.description ?? null,
      type,
    },
    articles: result.items as TaxonomyPageData['articles'],
    pagination: result.meta,
    settings,
    components,
  }
}

export async function loadCategoriesIndexData(
  searchParams: { page?: string },
  components: ThemeComponents,
): Promise<CategoriesIndexPageData> {
  const settings = await getMergedSettings()
  const page = parsePage(searchParams.page)
  const result = await listPublicCategories({ page, pageSize: 30 })

  return {
    categories: result.items,
    pagination: result.meta,
    settings,
    components,
  }
}

export async function loadTagsIndexData(
  searchParams: { page?: string },
  components: ThemeComponents,
): Promise<TagsIndexPageData> {
  const settings = await getMergedSettings()
  const page = parsePage(searchParams.page)
  const result = await listPublicTags({ page, pageSize: 50 })

  return {
    tags: result.items,
    pagination: result.meta,
    settings,
    components,
  }
}

export async function loadSearchData(
  query: string,
  searchParams: { page?: string },
  components: ThemeComponents,
): Promise<SearchPageData> {
  const settings = await getMergedSettings()
  const page = parsePage(searchParams.page)
  const result = await searchArticles({ q: query, page, pageSize: 12 })

  return {
    query,
    articles: result.items as SearchPageData['articles'],
    pagination: result.meta,
    settings,
    components,
  }
}

export { pageHrefBuilder }
