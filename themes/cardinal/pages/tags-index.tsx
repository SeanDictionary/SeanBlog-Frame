import Link from 'next/link'
import type { Route } from 'next'

import { Pagination } from '@/components/pagination'
import type { TagsIndexPageData } from '@/lib/theme/page-types'
import { buildDynamicCss } from '../lib/settings-helpers'

export default function CardinalTagsIndexPage({ data }: { data: TagsIndexPageData }) {
  const { tags, pagination, settings } = data

  function pageHref(page: number): Route {
    return (page === 1 ? '/tags' : `/tags?page=${page}`) as Route
  }

  return (
    <>
      <style>{buildDynamicCss(settings)}</style>
      <div className="flex justify-center px-4 py-12"><div className="w-(--layout-content-max-width)">
        <header className="mb-8 border-b border-border pb-6">
          <p className="mb-1 text-sm text-text-tertiary">索引</p>
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>标签</h1>
        </header>

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/tags/${tag.slug}` as Route}
              className="rounded-(--radius) bg-(--color-muted-bg) px-3 py-1.5 text-base text-text-secondary transition-colors hover:text-accent"
            >
              {tag.name}
              <span className="ml-1.5 text-sm text-text-tertiary">{tag._count.articles}</span>
            </Link>
          ))}
        </div>

        <div className="mt-6">
          <Pagination currentPage={pagination.page} pageCount={pagination.pageCount} hrefForPage={pageHref} />
      </div></div></div>
    </>
  )
}
