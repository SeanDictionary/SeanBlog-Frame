import Link from 'next/link'

export type ArticleMetaProps = {
  publishedAt: Date | null
  category: { name: string; slug: string } | null
  tags: Array<{ id: string; name: string; slug: string }>
  viewCount: number
  readingMinutes?: number
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

export function ArticleMeta({ publishedAt, category, tags, viewCount, readingMinutes }: ArticleMetaProps) {
  const publishedDate = formatPublishedDate(publishedAt)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
      {publishedDate && (
        <time dateTime={publishedAt?.toISOString()} className="inline-flex items-center gap-2">
          <i className="fa-regular fa-calendar" aria-hidden="true" />
          {publishedDate}
        </time>
      )}
      <span className="inline-flex items-center gap-2">
        <i className="fa-regular fa-eye" aria-hidden="true" />
        {viewCount} 次阅读
      </span>
      {readingMinutes !== undefined && (
        <span className="inline-flex items-center gap-2">
          <i className="fa-regular fa-clock" aria-hidden="true" />
          约 {readingMinutes} 分钟阅读
        </span>
      )}
      {category && (
        <Link href={`/categories/${category.slug}`} className="transition-colors hover:text-accent">
          {category.name}
        </Link>
      )}
      {tags.map((tag) => (
        <Link key={tag.id} href={`/tags/${tag.slug}`} className="transition-colors hover:text-accent">
          #{tag.name}
        </Link>
      ))}
    </div>
  )
}
