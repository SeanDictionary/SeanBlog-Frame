import Link from 'next/link'
import type { Route } from 'next'

type PaginationProps = {
  currentPage: number
  pageCount: number
  hrefForPage: (page: number) => Route
}

function getVisiblePages(currentPage: number, pageCount: number) {
  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1])

  return [...pages]
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((left, right) => left - right)
}

export function Pagination({ currentPage, pageCount, hrefForPage }: PaginationProps) {
  if (pageCount <= 1) {
    return null
  }

  const pages = getVisiblePages(currentPage, pageCount)

  return (
    <nav className="mt-10 flex items-center justify-between border-t border-border pt-6" aria-label="分页">
      {currentPage > 1 ? (
        <Link
          href={hrefForPage(currentPage - 1)}
          className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-accent"
        >
          <i className="fa-solid fa-arrow-left text-xs" aria-hidden="true" />
          上一页
        </Link>
      ) : (
        <span className="inline-flex items-center gap-2 text-sm text-text-tertiary" aria-disabled="true">
          <i className="fa-solid fa-arrow-left text-xs" aria-hidden="true" />
          上一页
        </span>
      )}

      <div className="flex items-center gap-1" aria-label={`第 ${currentPage} 页，共 ${pageCount} 页`}>
        {pages.map((page, index) => {
          const previous = pages[index - 1]
          const showGap = previous !== undefined && page - previous > 1

          return (
            <span key={page} className="contents">
              {showGap && <span className="px-1 text-sm text-text-tertiary">…</span>}
              <Link
                href={hrefForPage(page)}
                aria-current={page === currentPage ? 'page' : undefined}
                className={`grid size-8 place-items-center rounded-sm text-sm transition-colors ${
                  page === currentPage
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text'
                }`}
              >
                {page}
              </Link>
            </span>
          )
        })}
      </div>

      {currentPage < pageCount ? (
        <Link
          href={hrefForPage(currentPage + 1)}
          className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-accent"
        >
          下一页
          <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
        </Link>
      ) : (
        <span className="inline-flex items-center gap-2 text-sm text-text-tertiary" aria-disabled="true">
          下一页
          <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
        </span>
      )}
    </nav>
  )
}
