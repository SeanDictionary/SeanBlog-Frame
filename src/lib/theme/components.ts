/**
 * 主题注入组件映射
 *
 * 主题页面通过 data.components.* 获取平台预建组件，无需也不能直接 import @/。
 * 这是"最严白名单"渲染模型下主题获取平台能力的唯一通道。
 *
 * 服务端组装：这些组件可在 Server Component 中引用并作为 ComponentType 注入。
 */

import type { ComponentType } from 'react'

import { ArticleCard } from '@/components/article/article-card'
import { ArticleContent } from '@/components/article/article-content'
import { ArticleMeta } from '@/components/article/article-meta'
import { ArticleNavigation } from '@/components/article/article-navigation'
import { ArticleToc } from '@/components/article/article-toc'
import { CommentList } from '@/components/comment/comment-list'
import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { Pagination } from '@/components/pagination'
import { SearchDialog } from '@/components/search/search-dialog'
import { HighlightedText } from '@/components/search/highlighted-text'

import type { ThemeComponents } from './page-types'

/** 返回主题可用的注入组件全集 */
export function getThemeComponents(): ThemeComponents {
  return {
    ArticleContent: ArticleContent as ComponentType<{ html: string }>,
    ArticleMeta: ArticleMeta as ComponentType<Record<string, unknown>>,
    ArticleNavigation: ArticleNavigation as ComponentType<{ previous: { title: string; slug: string } | null; next: { title: string; slug: string } | null }>,
    ArticleToc: ArticleToc as ComponentType<{ headings: { id: string; text: string; level: number }[] }>,
    ArticleCard: ArticleCard as ComponentType<Record<string, unknown>>,
    CommentList: CommentList as ComponentType<Record<string, unknown>>,
    Pagination: Pagination as ComponentType<{ currentPage: number; pageCount: number; hrefForPage: (page: number) => import('next').Route }>,
    SiteHeader: SiteHeader as ComponentType<{ settings: Record<string, unknown> }>,
    SiteFooter: SiteFooter as ComponentType<{ settings: Record<string, unknown> }>,
    SearchDialog: SearchDialog as ComponentType<Record<string, unknown>>,
    MobileSidebar: MobileSidebar as ComponentType<Record<string, unknown>>,
    HighlightedText: HighlightedText as ComponentType<Record<string, unknown>>,
  }
}
