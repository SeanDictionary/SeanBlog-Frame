import Link from 'next/link'
import type { Route } from 'next'

import { ArticleContent } from '@/components/article/article-content'
import { ArticleMeta } from '@/components/article/article-meta'
import { ArticleNavigation } from '@/components/article/article-navigation'
import { ArticleToc } from '@/components/article/article-toc'
import { CommentList } from '@/components/comment/comment-list'
import type { ArticleDetailPageData } from '@/lib/theme/page-types'
import { buildDynamicCss, getSettingString, isSettingTrue, getSidebarItems } from '../lib/settings-helpers'

export default function CardinalArticleDetailPage({ data }: { data: ArticleDetailPageData }) {
  const { article, contentHtml, toc, readingMinutes, wordCount, navigation, comments, settings } = data
  const commentsMode = data.commentsMode

  const sidebarPos = getSettingString(settings, 'sidebarPosition', 'right')
  const hasSidebar = sidebarPos !== 'none'
  const sidebarItems = getSidebarItems(settings)
  const showToc = sidebarItems.includes('toc') && toc.length > 0

  // 从主题设置构建文章元信息显示配置
  const metaItems = Array.isArray(settings.articleMetaItems)
    ? settings.articleMetaItems.filter((v): v is string => typeof v === 'string')
    : ['publishedAt', 'viewCount', 'category', 'tags']
  const showReading = isSettingTrue(settings, 'showReadingTime')

  const metaOrder = [...metaItems]
  if (showReading && !metaOrder.includes('readingTime' as any)) metaOrder.push('readingTime' as any)
  if (showReading && !metaOrder.includes('wordCount' as any)) metaOrder.push('wordCount' as any)

  const sidebarEl = showToc ? (
    <ArticleToc headings={toc} />
  ) : null

  return (
    <>
      <style>{buildDynamicCss(settings)}</style>

      <div className="flex justify-center px-4 py-12">
        <div className="flex gap-[var(--layout-gap)] items-start">
          {/* 左侧栏（文章 TOC） */}
          {sidebarPos === 'left' && sidebarEl ? (
            <aside className="hidden w-[var(--layout-sidebar-width)] shrink-0 lg:block">
              <div className="sticky top-20">{sidebarEl}</div>
            </aside>
          ) : null}

        <article className="min-w-0 w-[var(--layout-content-max-width)]">
          <header className="mb-8">
            <p className="mb-2 text-sm text-text-tertiary">文章</p>
            <h1 className="text-4xl font-bold leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              {article.title}
            </h1>
            {article.coverImage && (
              <img src={article.coverImage} alt="" className="mt-6 aspect-video w-full rounded-[var(--radius)] border border-border object-cover" />
            )}
            <div className="mt-4">
              <ArticleMeta
                publishedAt={article.publishedAt}
                category={article.category}
                tags={article.tags}
                viewCount={article.viewCount}
                readingMinutes={readingMinutes}
                wordCount={wordCount}
                visibility={{
                  showPublishedAt: metaItems.includes('publishedAt'),
                  showViewCount: metaItems.includes('viewCount'),
                  showCategory: metaItems.includes('category'),
                  showTags: metaItems.includes('tags'),
                  showReadingTime: showReading,
                  showWordCount: showReading,
                  order: metaOrder as any,
                }}
              />
            </div>
          </header>

          <ArticleContent html={contentHtml} />

          <ArticleNavigation previous={navigation.previous} next={navigation.next} />

          <CommentList articleId={article.id} comments={comments as any} mode={commentsMode} />
        </article>

        {/* 右侧栏（TOC） */}
        {sidebarPos === 'right' && sidebarEl ? (
          <aside className="hidden w-[var(--layout-sidebar-width)] shrink-0 lg:block">
            <div className="sticky top-20">{sidebarEl}</div>
          </aside>
        ) : null}
        </div>
      </div>
    </>
  )
}
