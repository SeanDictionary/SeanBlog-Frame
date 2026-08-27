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
  const { article, contentHtml, toc, readingMinutes, wordCount, navigation, comments, metaVisibility, settings } = data
  const commentsMode = data.commentsMode

  const sidebarPos = getSettingString(settings, 'sidebarPosition', 'right')
  const hasSidebar = sidebarPos !== 'none'
  const sidebarItems = getSidebarItems(settings)
  const showToc = sidebarItems.includes('toc') && toc.length > 0

  const layoutClass =
    sidebarPos === 'right' && (showToc || hasSidebar) ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-10' :
    sidebarPos === 'left' && (showToc || hasSidebar) ? 'lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10' :
    ''

  const sidebarEl = showToc ? (
    <ArticleToc headings={toc} />
  ) : null

  return (
    <>
      <style>{buildDynamicCss(settings)}</style>

      <div className={`mx-auto max-w-[var(--layout-content-max-width)] px-4 py-12 ${layoutClass}`}>
        {/* 左侧栏（文章 TOC） */}
        {sidebarPos === 'left' && sidebarEl ? (
          <aside className="hidden lg:block">
            <div className="sticky top-20">{sidebarEl}</div>
          </aside>
        ) : null}

        <article className="min-w-0">
          <header className="mb-8">
            <p className="mb-2 text-xs text-text-tertiary">文章</p>
            <h1 className="text-3xl font-bold leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>
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
                  showPublishedAt: metaVisibility.showPublishedAt,
                  showViewCount: metaVisibility.showViewCount,
                  showReadingTime: metaVisibility.showReadingTime,
                  showWordCount: metaVisibility.showWordCount,
                  showCategory: metaVisibility.showCategory,
                  showTags: metaVisibility.showTags,
                  order: metaVisibility.order as any,
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
          <aside className="hidden lg:block">
            <div className="sticky top-20">{sidebarEl}</div>
          </aside>
        ) : null}
      </div>
    </>
  )
}
