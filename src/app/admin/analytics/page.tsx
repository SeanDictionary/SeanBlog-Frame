import type { Route } from 'next'

import { AnalyticsDashboard } from '@/components/admin/analytics-dashboard'
import { getAnalyticsDashboard } from '@/lib/services/analytics-service'
import { analyticsQuerySchema } from '@/lib/validations/cms'

function buildExportHref(filters: { start?: string; end?: string; dimension: string; slug?: string }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  return `/api/admin/analytics/export?${params.toString()}` as Route
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string; dimension?: string; slug?: string }>
}) {
  const rawSearchParams = await searchParams
  const query = analyticsQuerySchema.parse(rawSearchParams)
  const data = await getAnalyticsDashboard(query)
  const filters = {
    start: rawSearchParams.start,
    end: rawSearchParams.end,
    dimension: query.dimension,
    slug: query.slug,
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <p className="mb-2 text-sm text-neutral-500">数据分析</p>
        <h1 className="text-3xl font-semibold tracking-tight">统计</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">查看访问趋势、热门文章、分类和标签。隐私字段默认不采集，可在设置中单独开启。</p>
      </header>
      <AnalyticsDashboard data={data} filters={filters} exportHref={buildExportHref(filters)} />
    </div>
  )
}
