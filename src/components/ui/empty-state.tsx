import type { ReactNode } from 'react'

type EmptyStateProps = {
  children: ReactNode
  size?: 'sm' | 'md'
  className?: string
}

export function EmptyState({ children, size = 'md', className = '' }: EmptyStateProps) {
  const padding = size === 'sm' ? 'px-3 py-5' : 'px-5 py-12'
  const border = size === 'sm' ? 'border-neutral-200 dark:border-neutral-800' : 'border-neutral-300 dark:border-neutral-700'
  return (
    <div className={`rounded-lg border border-dashed ${border} ${padding} text-center text-sm text-neutral-500 ${className}`}>
      {children}
    </div>
  )
}

type ExportCsvButtonProps = {
  href: string
}

export function ExportCsvButton({ href }: ExportCsvButtonProps) {
  return (
    <a
      href={href}
      className="rounded-md bg-neutral-950 px-3 py-1.5 text-sm text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200"
    >
      导出 CSV
    </a>
  )
}

/** Build a CSV export URL from the current search params, dropping page/pageSize. */
export function buildExportHref(basePath: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page' && key !== 'pageSize') {
      search.set(key, value)
    }
  }
  const query = search.toString()
  return `${basePath}${query ? `?${query}` : ''}`
}

type LinkButtonProps = {
  href: string
  children: ReactNode
  className?: string
}

/** Secondary outline-style link used for cross-navigation between admin pages. */
export function LinkButton({ href, children, className = '' }: LinkButtonProps) {
  return (
    <a
      href={href}
      className={`rounded-md border border-neutral-300 px-4 py-2 text-sm transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900 ${className}`}
    >
      {children}
    </a>
  )
}
