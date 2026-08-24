import { VisitRecordTable } from '@/components/admin/analytics-dashboard'
import { AutoSubmitForm } from '@/components/common/auto-submit-form'
import { getAnalyticsVisitors } from '@/lib/services/analytics-service'
import { analyticsVisitorQuerySchema } from '@/lib/validations/cms'

type AdminAnalyticsVisitorsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>
}

function buildPageHref(params: Record<string, string | undefined>, page: number) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page') searchParams.set(key, value)
  }
  if (page > 1) searchParams.set('page', String(page))
  const query = searchParams.toString()
  return `/admin/visitors${query ? `?${query}` : ''}`
}

function buildExportHref(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page' && key !== 'pageSize') searchParams.set(key, value)
  }
  const query = searchParams.toString()
  return `/api/admin/analytics/visitors/export${query ? `?${query}` : ''}`
}

export default async function AdminAnalyticsVisitorsPage({ searchParams }: AdminAnalyticsVisitorsPageProps) {
  const rawSearchParams = await searchParams
  const query = analyticsVisitorQuerySchema.parse(rawSearchParams)
  const result = await getAnalyticsVisitors(query)
  const startValue = rawSearchParams.start ?? ''
  const endValue = rawSearchParams.end ?? ''
  const previousHref = result.meta.page > 1 ? buildPageHref(rawSearchParams, result.meta.page - 1) : null
  const nextHref = result.meta.page < result.meta.pageCount ? buildPageHref(rawSearchParams, result.meta.page + 1) : null

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-neutral-500">数据分析 / 访客统计</p>
          <h1 className="text-3xl font-semibold tracking-tight">访客统计</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">显示有史以来的访问记录，支持按 20 / 50 / 100 条分页，并可按时间范围导出 CSV。</p>
        </div>
        <div className="flex gap-2 text-sm"><a href="/admin/overview" className="rounded-md border border-neutral-300 px-4 py-2 dark:border-neutral-700">统计总览</a><a href={buildExportHref(rawSearchParams)} className="rounded-md bg-neutral-950 px-4 py-2 text-white dark:bg-neutral-100 dark:text-neutral-950">导出 CSV</a></div>
      </header>

      <AutoSubmitForm action="/admin/visitors" className="mb-6 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
        <label className="grid gap-1.5">开始日期<input name="start" type="date" defaultValue={startValue} className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <label className="grid gap-1.5">结束日期<input name="end" type="date" defaultValue={endValue} className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <label className="grid gap-1.5">每页显示<select name="pageSize" defaultValue={query.pageSize} className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900"><option value="20">20 条</option><option value="50">50 条</option><option value="100">100 条</option></select></label>
      </AutoSubmitForm>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">访问记录</h2><p className="mt-1 text-sm text-neutral-500">共 {result.meta.total} 条记录，第 {result.meta.page} / {Math.max(1, result.meta.pageCount)} 页。</p></div>
          <div className="flex gap-2 text-sm">{previousHref ? <a href={previousHref} className="rounded-md border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">上一页</a> : <span className="rounded-md border border-neutral-200 px-3 py-1.5 text-neutral-400 dark:border-neutral-800">上一页</span>}{nextHref ? <a href={nextHref} className="rounded-md border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">下一页</a> : <span className="rounded-md border border-neutral-200 px-3 py-1.5 text-neutral-400 dark:border-neutral-800">下一页</span>}</div>
        </div>
        <VisitRecordTable visits={result.items} />
      </section>
    </div>
  )
}
