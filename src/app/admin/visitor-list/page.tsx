import Link from 'next/link'
import type { Route } from 'next'

import { getVisitors } from '@/lib/services/analytics-service'
import { paginationQuerySchema } from '@/lib/validations/cms'
import { AutoSubmitForm } from '@/components/common/auto-submit-form'

const PAGE_SIZE_OPTIONS = [20, 50, 100]

function buildPageHref(params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page') search.set(key, value)
  }
  if (page > 1) search.set('page', String(page))
  const query = search.toString()
  return `/admin/visitor-list${query ? `?${query}` : ''}` as Route
}

function buildExportHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page' && key !== 'pageSize') search.set(key, value)
  }
  const query = search.toString()
  return `/api/admin/analytics/visitors/export${query ? `?${query}` : ''}`
}

function getPageItems(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const items: Array<number | 'ellipsis'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push('ellipsis')
  for (let page = start; page <= end; page += 1) items.push(page)
  if (end < total - 1) items.push('ellipsis')
  items.push(total)
  return items
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export default async function VisitorListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const rawSearchParams = await searchParams
  const query = paginationQuerySchema.parse(rawSearchParams)
  const result = await getVisitors(query)
  const startValue = rawSearchParams.start ?? ''
  const endValue = rawSearchParams.end ?? ''
  const page = result.meta.page
  const pageCount = Math.max(1, result.meta.pageCount)
  const pageItems = getPageItems(page, pageCount)

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-neutral-500">数据分析 / 访客记录</p>
          <h1 className="text-3xl font-semibold tracking-tight">访客记录</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">按访客维度展示，每位唯一访客一行。点击访客标识可进入详情页。</p>
        </div>
        <div className="flex gap-2 text-sm"><a href="/admin/visitors" className="rounded-md border border-neutral-300 px-4 py-2 dark:border-neutral-700">访问记录</a><a href={buildExportHref(rawSearchParams)} className="rounded-md bg-neutral-950 px-4 py-2 text-white dark:bg-neutral-100 dark:text-neutral-950">导出 CSV</a></div>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">访客列表</h2>
            <p className="mt-1 text-sm text-neutral-500">共 {result.meta.total} 位访客，第 {page} / {pageCount} 页。</p>
          </div>
          <AutoSubmitForm action="/admin/visitor-list" className="flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="pageSize" value={query.pageSize} />
            <input name="start" type="date" defaultValue={startValue} className="h-8 rounded-md border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-900" />
            <span className="text-neutral-500">至</span>
            <input name="end" type="date" defaultValue={endValue} className="h-8 rounded-md border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-900" />
          </AutoSubmitForm>
        </div>

        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-2xl text-left text-sm">
            <thead className="border-b border-neutral-100 text-xs text-neutral-500 dark:border-neutral-900">
              <tr>
                <th className="py-2 pl-5 pr-4">访客标识</th>
                <th className="py-2 pr-4">首次访问</th>
                <th className="py-2 pr-4">最近访问</th>
                <th className="py-2 pr-4 text-right">访问次数</th>
                <th className="py-2 pr-4 text-right">总时长</th>
                <th className="py-2 pr-5">访问最多文章</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {result.items.map((visitor) => (
                <tr key={visitor.visitorId} className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
                  <td className="py-3 pl-5 pr-4">
                    <Link href={`/admin/visitor-list/${visitor.visitorId}` as Route} className="font-mono text-xs text-neutral-950 dark:text-neutral-50 transition-colors hover:text-blue-600 dark:hover:text-blue-300" title={visitor.visitorId}>{visitor.visitorId}</Link>
                  </td>
                  <td className="py-3 pr-4 text-neutral-500">{formatDateTime(visitor.firstSeenAt)}</td>
                  <td className="py-3 pr-4 text-neutral-500">{formatDateTime(visitor.lastSeenAt)}</td>
                  <td className="py-3 pr-4 text-right font-medium">{visitor.visitCount}</td>
                  <td className="py-3 pr-4 text-right text-neutral-500">{visitor.totalDurationSeconds < 60 ? `${visitor.totalDurationSeconds}s` : `${Math.floor(visitor.totalDurationSeconds / 60)}m`}</td>
                  <td className="py-3 pr-5">
                    {visitor.topArticleTitle ? (
                      <a href={`/articles/${visitor.topArticleSlug}`} target="_blank" rel="noopener noreferrer" className="block max-w-48 truncate font-medium text-neutral-700 transition-colors hover:text-blue-600 dark:text-neutral-200 dark:hover:text-blue-300">{visitor.topArticleTitle}</a>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {result.items.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-neutral-500">暂无访客记录。</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {pageItems.map((item, index) =>
            item === 'ellipsis' ? (
              <span key={`e-${index}`} className="px-1 text-neutral-400">…</span>
            ) : item === page ? (
              <span key={item} aria-current="page" className="min-w-8 rounded-md border border-neutral-950 bg-neutral-950 px-2 py-1 text-center text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950">{item}</span>
            ) : (
              <a key={item} href={buildPageHref(rawSearchParams, item)} className="min-w-8 rounded-md border border-neutral-300 px-2 py-1 text-center transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900">{item}</a>
            ),
          )}
          <AutoSubmitForm action="/admin/visitor-list" className="ml-2 flex items-center gap-1.5">
            <input type="hidden" name="start" value={startValue} />
            <input type="hidden" name="end" value={endValue} />
            <span className="text-neutral-500">每页</span>
            <select name="pageSize" defaultValue={query.pageSize} className="h-8 rounded-md border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-900">
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} 条</option>)}
            </select>
          </AutoSubmitForm>
        </div>
      </section>
    </div>
  )
}
