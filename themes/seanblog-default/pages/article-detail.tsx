import type { ReactNode } from 'react'

import { ArticleContent } from '@/components/article/article-content'
import { ArticleMeta } from '@/components/article/article-meta'
import { ArticleNavigation } from '@/components/article/article-navigation'
import { ArticleToc } from '@/components/article/article-toc'
import { CommentList } from '@/components/comment/comment-list'

export default function DefaultArticleDetailPage({ data }: { data: any }) {
  const { article, contentHtml, toc, readingMinutes, wordCount, commentsMode, navigation, comments } = data

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
        {article.coverImage && (
          <img src={article.coverImage} alt="" className="mt-8 aspect-video w-full rounded-(--radius) border border-border object-cover" />
        )}
      </header>
    ),
    'article-content': <ArticleContent html={contentHtml} />,
    'article-navigation': <ArticleNavigation previous={navigation.previous} next={navigation.next} />,
    comments: <CommentList articleId={article.id} comments={comments as any} mode={commentsMode as any} />,
    toc: <ArticleToc headings={toc} />,
  }
  const slots = ['article-header', 'article-content', 'article-navigation', 'comments', 'toc']

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
