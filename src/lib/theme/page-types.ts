/**
 * 数据契约类型定义 — 主题页面组件的 props 类型。
 *
 * 主题作者通过这些类型了解可用数据和注入组件。
 * 核心层负责数据获取和预处理，主题层只消费这些 props。
 *
 * 稳定性规则：
 * - 新增字段不算 breaking change（旧主题忽略新字段）
 * - 删除/重命名字段是 breaking change → 升 engineVersion
 */

import type { Route } from 'next'
import type { ComponentType, ReactNode } from 'react'

// --- 基础类型 ---

export type SiteSettings = Record<string, unknown>

export type Pagination = {
  page: number
  pageCount: number
  total: number
}

export type SortOption = {
  value: string
  label: string
  href: Route
}

export type TocItem = {
  id: string
  text: string
  level: number
}

export type ArticleNavigation = {
  previous: { title: string; slug: string } | null
  next: { title: string; slug: string } | null
}

// --- 首页 ---

export type SidebarData = {
  recentArticles: Array<{ id: string; title: string; slug: string; publishedAt: Date | null }>
  tags: Array<{ id: string; name: string; slug: string }>
  categories: Array<{ id: string; name: string; slug: string; _count: { articles: number } }>
}

export type HomePageData = {
  articles: Array<{
    id: string
    title: string
    slug: string
    excerpt: string | null
    coverImage: string | null
    isPinned: boolean
    publishedAt: Date | null
    updatedAt?: Date | null
    viewCount: number
    visitorCount?: number
    _count: { comments: number }
    category: { id: string; name: string; slug: string } | null
    tags: Array<{ id: string; name: string; slug: string; description: string | null }>
  }>
  pinned: HomePageData['articles']
  pagination: Pagination
  sort: string
  sortOptions: SortOption[]
  settings: SiteSettings
  /** 侧边栏数据（路由层预加载） */
  sidebarData?: SidebarData
  /** 预建组件，主题可直接使用 */
  components: ThemeComponents
}

// --- 文章详情 ---

export type ArticleDetailPageData = {
  article: {
    id: string
    title: string
    slug: string
    excerpt: string | null
    coverImage: string | null
    publishedAt: Date | null
    updatedAt?: Date | null
    viewCount: number
    visitorCount?: number
    metaTitle: string | null
    metaDescription: string | null
    metaKeywords: string | null
    category: { id: string; name: string; slug: string } | null
    tags: Array<{ id: string; name: string; slug: string; description: string | null }>
  }
  contentHtml: string
  toc: TocItem[]
  readingMinutes: number
  wordCount: number
  commentsMode: 'enabled' | 'readOnly' | 'disabled'
  navigation: ArticleNavigation
  comments: Array<{
    id: string
    content: string
    status: 'PENDING' | 'APPROVED' | 'SPAM' | 'TRASHED'
    visitorId: string | null
    createdAt: Date
    visitor: { visitorId: string } | null
    replies: unknown[]
  }>
  metaVisibility: {
    showPublishedAt: boolean
    showViewCount: boolean
    showReadingTime: boolean
    showWordCount: boolean
    showCategory: boolean
    showTags: boolean
    order: string[]
  }
  settings: SiteSettings
  components: ThemeComponents
}

// --- 分类/标签文章列表 ---

export type TaxonomyPageData = {
  taxonomy: {
    name: string
    slug: string
    description: string | null
    type: 'category' | 'tag'
  }
  articles: HomePageData['articles']
  pagination: Pagination
  settings: SiteSettings
  components: ThemeComponents
}

// --- 分类索引 ---

export type CategoriesIndexPageData = {
  categories: Array<{
    id: string
    name: string
    slug: string
    description: string | null
    _count: { articles: number }
  }>
  pagination: Pagination
  settings: SiteSettings
  components: ThemeComponents
}

// --- 标签索引 ---

export type TagsIndexPageData = {
  tags: Array<{
    id: string
    name: string
    slug: string
    description: string | null
    _count: { articles: number }
  }>
  pagination: Pagination
  settings: SiteSettings
  components: ThemeComponents
}

// --- 搜索 ---

export type SearchPageData = {
  query: string
  articles: HomePageData['articles']
  pagination: Pagination
  settings: SiteSettings
  components: ThemeComponents
}

// --- 注入的预建组件 ---

export type ThemeComponents = {
  /** 文章正文 HTML 渲染（Server，可被 parts 覆盖） */
  ArticleContent?: ComponentType<{ html: string }>
  /** 文章元信息（Server，可被覆盖） */
  ArticleMeta?: ComponentType<Record<string, unknown>>
  /** 上下篇导航（Server，可被覆盖） */
  ArticleNavigation?: ComponentType<{ previous: { title: string; slug: string } | null; next: { title: string; slug: string } | null }>
  /** 目录（Server，可被覆盖） */
  ArticleToc?: ComponentType<{ headings: TocItem[] }>
  /** 评论列表（Server，可被覆盖，内部含 CommentForm Client 组件） */
  CommentList?: ComponentType<Record<string, unknown>>
  /** 分页（Server，可被覆盖） */
  Pagination?: ComponentType<{ currentPage: number; pageCount: number; hrefForPage: (page: number) => Route }>
  /** 搜索对话框（Client，不可覆盖） */
  SearchDialog?: ComponentType<Record<string, unknown>>
  /** 站点 Header（Server，可被 parts 覆盖） */
  SiteHeader?: ComponentType<{ settings: SiteSettings }>
  /** 站点 Footer（Server，可被 parts 覆盖） */
  SiteFooter?: ComponentType<{ settings: SiteSettings }>
}

// --- 页面类型映射 ---

export type PageType = 'home' | 'article-detail' | 'taxonomy' | 'categories-index' | 'tags-index' | 'search'

export type PageData<T extends PageType> =
  T extends 'home' ? HomePageData :
  T extends 'article-detail' ? ArticleDetailPageData :
  T extends 'taxonomy' ? TaxonomyPageData :
  T extends 'categories-index' ? CategoriesIndexPageData :
  T extends 'tags-index' ? TagsIndexPageData :
  T extends 'search' ? SearchPageData :
  never

export type ThemePage<T extends PageType = PageType> = ComponentType<{ data: PageData<T> }>
