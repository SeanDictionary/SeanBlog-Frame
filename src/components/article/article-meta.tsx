import Link from 'next/link'
import { Fragment } from 'react'

export const ARTICLE_META_ITEM_IDS = ['publishedAt', 'viewCount', 'readingTime', 'wordCount', 'category', 'tags'] as const

export type ArticleMetaItemId = (typeof ARTICLE_META_ITEM_IDS)[number]

export type ArticleMetaVisibility = {
  showPublishedAt?: boolean
  showViewCount?: boolean
  showReadingTime?: boolean
  showWordCount?: boolean
  showCategory?: boolean
  showTags?: boolean
  order?: ArticleMetaItemId[]
}

export type ArticleMetaProps = {
  publishedAt: Date | null
  category: { name: string; slug: string } | null
  tags: Array<{ id: string; name: string; slug: string }>
  viewCount: number
  readingMinutes?: number
  wordCount?: number
  visibility?: ArticleMetaVisibility
}

function formatPublishedDate(date: Date | null) {
  if (!date) {
    return null
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function normalizeOrder(order: ArticleMetaItemId[] | undefined) {
  const ordered = order?.filter((item, index, items) => ARTICLE_META_ITEM_IDS.includes(item) && items.indexOf(item) === index) ?? []
  const orderedSet = new Set(ordered)

  return [...ordered, ...ARTICLE_META_ITEM_IDS.filter((item) => !orderedSet.has(item))]
}

export function ArticleMeta({ publishedAt, category, tags, viewCount, readingMinutes, wordCount, visibility }: ArticleMetaProps) {
  const publishedDate = formatPublishedDate(publishedAt)
  const showPublishedAt = visibility?.showPublishedAt !== false
  const showViewCount = visibility?.showViewCount !== false
  const showReadingTime = visibility?.showReadingTime !== false
  const showWordCount = visibility?.showWordCount !== false
  const showCategory = visibility?.showCategory !== false
  const showTags = visibility?.showTags !== false
  const items: Record<ArticleMetaItemId, React.ReactNode> = {
    publishedAt: showPublishedAt && publishedDate ? (
      <time dateTime={publishedAt?.toISOString()} className="inline-flex items-center gap-2">
        <i className="fa-regular fa-calendar" aria-hidden="true" />
        {publishedDate}
      </time>
    ) : null,
    viewCount: showViewCount ? (
      <span className="inline-flex items-center gap-2">
        <i className="fa-regular fa-eye" aria-hidden="true" />
        {viewCount} 次阅读
      </span>
    ) : null,
    readingTime: showReadingTime && readingMinutes !== undefined ? (
      <span className="inline-flex items-center gap-2">
        <i className="fa-regular fa-clock" aria-hidden="true" />
        约 {readingMinutes} 分钟阅读
      </span>
    ) : null,
    wordCount: showWordCount && wordCount !== undefined ? (
      <span className="inline-flex items-center gap-2">
        <i className="fa-regular fa-file-lines" aria-hidden="true" />
        {wordCount.toLocaleString('zh-CN')} 字
      </span>
    ) : null,
    category: showCategory && category ? (
      <Link href={`/categories/${category.slug}`} className="transition-colors hover:text-accent">
        {category.name}
      </Link>
    ) : null,
    tags: showTags ? tags.map((tag) => (
      <Link key={tag.id} href={`/tags/${tag.slug}`} className="transition-colors hover:text-accent">
        #{tag.name}
      </Link>
    )) : null,
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
      {normalizeOrder(visibility?.order).map((item) => <Fragment key={item}>{items[item]}</Fragment>)}
    </div>
  )
}
