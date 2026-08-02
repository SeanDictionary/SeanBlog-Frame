import Link from 'next/link'

export type ArticleMetaVisibility = {
  showPublishedAt?: boolean
  showViewCount?: boolean
  showReadingTime?: boolean
  showWordCount?: boolean
  showCategory?: boolean
  showTags?: boolean
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

export function ArticleMeta({ publishedAt, category, tags, viewCount, readingMinutes, wordCount, visibility }: ArticleMetaProps) {
  const publishedDate = formatPublishedDate(publishedAt)
  const showPublishedAt = visibility?.showPublishedAt !== false
  const showViewCount = visibility?.showViewCount !== false
  const showReadingTime = visibility?.showReadingTime !== false
  const showWordCount = visibility?.showWordCount !== false
  const showCategory = visibility?.showCategory !== false
  const showTags = visibility?.showTags !== false

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
      {showPublishedAt && publishedDate && (
        <time dateTime={publishedAt?.toISOString()} className="inline-flex items-center gap-2">
          <i className="fa-regular fa-calendar" aria-hidden="true" />
          {publishedDate}
        </time>
      )}
      {showViewCount && (
        <span className="inline-flex items-center gap-2">
          <i className="fa-regular fa-eye" aria-hidden="true" />
          {viewCount} 次阅读
        </span>
      )}
      {showReadingTime && readingMinutes !== undefined && (
        <span className="inline-flex items-center gap-2">
          <i className="fa-regular fa-clock" aria-hidden="true" />
          约 {readingMinutes} 分钟阅读
        </span>
      )}
      {showWordCount && wordCount !== undefined && (
        <span className="inline-flex items-center gap-2">
          <i className="fa-regular fa-file-lines" aria-hidden="true" />
          {wordCount.toLocaleString('zh-CN')} 字
        </span>
      )}
      {showCategory && category && (
        <Link href={`/categories/${category.slug}`} className="transition-colors hover:text-accent">
          {category.name}
        </Link>
      )}
      {showTags && tags.map((tag) => (
        <Link key={tag.id} href={`/tags/${tag.slug}`} className="transition-colors hover:text-accent">
          #{tag.name}
        </Link>
      ))}
    </div>
  )
}
