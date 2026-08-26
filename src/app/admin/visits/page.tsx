import { VisitRecordTable } from '@/components/admin/analytics-dashboard'
import { AutoSubmitForm } from '@/components/common/auto-submit-form'
import { Card, CardHeader } from '@/components/ui/card'
import { ExportCsvButton, LinkButton, buildExportHref } from '@/components/ui/empty-state'
import { getAnalyticsVisitors } from '@/lib/services/analytics-service'
import { analyticsVisitorQuerySchema } from '@/lib/validations/cms'

type AdminAnalyticsVisitorsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>
}

const PAGE_SIZE_OPTIONS = [20, 50, 100]

function buildPageHref(params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page') search.set(key, value)
  }
  if (page > 1) search.set('page', String(page))
  const query = search.toString()
  return `/admin/visits${query ? `?${query}` : ''}`
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

export default async function AdminAnalyticsVisitorsPage({ searchParams }: AdminAnalyticsVisitorsPageProps) {
  const rawSearchParams = await searchParams
  const query = analyticsVisitorQuerySchema.parse(rawSearchParams)
  const result = await getAnalyticsVisitors(query)
  const startValue = rawSearchParams.start ?? ''
  const endValue = rawSearchParams.end ?? ''
  const page = result.meta.page
  const pageCount = Math.max(1, result.meta.pageCount)
  const pageItems = getPageItems(page, pageCount)

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-neutral-500">数据分析 / 访问记录</p>
          <h1 className="text-3xl font-semibold tracking-tight">访问记录</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">显示有史以来的访问记录，可按时间范围导出 CSV。</p>
        </div>
        <ExportCsvButton href={buildExportHref('/api/admin/analytics/visitors/export', rawSearchParams)} />
      </header>

      <Card>
        <CardHeader
          title="访问记录"
          description={`共 ${result.meta.total} 条记录，第 ${page} / ${pageCount} 页。`}
          action={
            <AutoSubmitForm action="/admin/visits" className="flex flex-wrap items-center gap-2 text-sm">
              <input type="hidden" name="pageSize" value={query.pageSize} />
              <input name="start" type="date" defaultValue={startValue} className="h-8 rounded-md border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-900" />
              <span className="text-neutral-500">至</span>
              <input name="end" type="date" defaultValue={endValue} className="h-8 rounded-md border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-900" />
            </AutoSubmitForm>
          }
        />

        <VisitRecordTable visits={result.items} />

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
          <AutoSubmitForm action="/admin/visits" className="ml-2 flex items-center gap-1.5">
            <input type="hidden" name="start" value={startValue} />
            <input type="hidden" name="end" value={endValue} />
            <span className="text-neutral-500">每页</span>
            <select name="pageSize" defaultValue={query.pageSize} className="h-8 rounded-md border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-900">
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} 条</option>)}
            </select>
          </AutoSubmitForm>
        </div>
      </Card>
    </div>
  )
}
