import type { Route } from 'next'
import Link from 'next/link'

export default function DefaultTagsIndexPage({ data }: { data: any }) {
  const { tags, pagination } = data
  const { Pagination } = data.components

  const pageHref = (page: number): Route => (page === 1 ? '/tags' : `/tags?page=${page}`) as Route

  return (
    <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 sm:py-18">
      <header className="mb-10 border-b border-border pb-8">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">关键词索引</p>
        <h1 className="text-4xl font-semibold tracking-[-0.045em]">标签</h1>
      </header>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {tags.map((tag: any) => (
            <Link
              key={tag.id}
              href={`/tags/${tag.slug}`}
              className="group inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm transition-colors hover:border-accent hover:bg-accent-subtle"
            >
              <span className="group-hover:text-accent">#{tag.name}</span>
              <span className="font-mono text-xs text-text-tertiary">{tag._count.articles}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="border-t border-border py-12 text-text-secondary">暂时没有可浏览的标签。</p>
      )}

      <Pagination currentPage={pagination.page} pageCount={pagination.pageCount} hrefForPage={pageHref} />
    </div>
  )
}
