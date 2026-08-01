import Link from 'next/link'
import type { ReactNode } from 'react'

import type { listPublicArticles } from '@/lib/services/article-service'

type Article = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  coverImage: string | null
  isPinned: boolean
  publishedAt: Date | null
  updatedAt?: Date
  viewCount?: number
  _count?: { comments: number }
  category: { id: string; name: string; slug: string } | null
  tags: Array<{ id: string; name: string; slug: string } | { tag: { id: string; name: string; slug: string } }>
}

type ArticleCardProps = {
  article: Article
  pinned?: boolean
  priority?: boolean
  renderTitle?: (title: string) => ReactNode
  renderExcerpt?: (excerpt: string) => ReactNode
}

function formatPublishedDate(date: Date | null) {
  if (!date) {
    return null
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function ArticleCard({ article, pinned = false, priority = false, renderTitle, renderExcerpt }: ArticleCardProps) {
  const publishedDate = formatPublishedDate(article.publishedAt)

  return (
    <article className="group relative grid gap-4 border-t border-border py-6 first:border-t-0 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-8">
      <div className="flex items-baseline gap-2 text-xs text-text-tertiary sm:block">
        {pinned && (
          <span className="mb-2 inline-flex items-center gap-1 text-accent">
            <i className="fa-solid fa-thumbtack text-[0.625rem]" aria-hidden="true" />
            置顶
          </span>
        )}
        {publishedDate && (
          <time dateTime={article.publishedAt?.toISOString()}>{publishedDate}</time>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-start gap-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-[-0.02em]">
              <Link
                href={`/articles/${article.slug}`}
                className="decoration-accent/50 underline-offset-4 transition-colors hover:text-accent hover:underline"
                prefetch={priority}
              >
                {renderTitle ? renderTitle(article.title) : article.title}
              </Link>
            </h2>

            {article.excerpt && (
              <p className="mt-2 leading-7 text-text-secondary">{renderExcerpt ? renderExcerpt(article.excerpt) : article.excerpt}</p>
            )}
          </div>

          {article.coverImage && (
            <img
              src={article.coverImage}
              alt=""
              className="hidden size-20 shrink-0 rounded-(--radius) border border-border object-cover sm:block"
            />
          )}
        </div>

        <footer className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-text-tertiary">
          {article.category && (
            <Link
              href={`/categories/${article.category.slug}`}
              className="transition-colors hover:text-accent"
            >
              {article.category.name}
            </Link>
          )}
          {article.tags.map((tag) => {
            const normalizedTag = 'tag' in tag ? tag.tag : tag

            return (
              <Link
                key={normalizedTag.id}
                href={`/tags/${normalizedTag.slug}`}
                className="transition-colors hover:text-accent"
              >
                #{normalizedTag.name}
              </Link>
            )
          })}
        </footer>
      </div>
    </article>
  )
}
