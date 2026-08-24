import type { Route } from 'next'

import { AutoSubmitForm } from '@/components/common/auto-submit-form'
import { AnalyticsTrendChart, type AnalyticsGranularityOption } from '@/components/admin/analytics-trend-chart'
import { VisitRecordTable } from '@/components/admin/analytics-dashboard'
import type { AnalyticsGranularity } from '@/lib/services/analytics-service'
import { getAnalyticsOverview } from '@/lib/services/analytics-service'
import { analyticsOverviewQuerySchema } from '@/lib/validations/cms'

type AdminAnalyticsOverviewPageProps = {
  searchParams: Promise<Record<string, string | undefined>>
}

const TREND_GRANULARITY_OPTIONS: Array<{ value: AnalyticsGranularity; label: string }> = [
  { value: 'day', label: '天' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
]

const RANGE_DAY_OPTIONS = [7, 30, 90, 180]

function buildTrendGranularityOptions(params: Record<string, string | undefined>, current: AnalyticsGranularity): AnalyticsGranularityOption[] {
  return TREND_GRANULARITY_OPTIONS.map((option) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== 'trendGranularity') search.set(key, value)
    }
    search.set('trendGranularity', option.value)
    return { value: option.value, label: option.label, href: `/admin/analytics/overview?${search.toString()}` as Route }
  })
}

function RangeSelectForm({ paramKey, currentParams }: { paramKey: string; currentParams: Record<string, string | undefined> }) {
  return (
    <AutoSubmitForm action="/admin/analytics/overview" className="flex items-center gap-2 text-sm">
      {Object.entries(currentParams).map(([key, value]) => (
        key !== paramKey && value ? <input key={key} type="hidden" name={key} value={value} /> : null
      ))}
      <select name={paramKey} defaultValue={currentParams[paramKey] ?? '30'} className="h-9 rounded-md border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-900">
        {RANGE_DAY_OPTIONS.map((days) => <option key={days} value={days}>近 {days} 天</option>)}
      </select>
    </AutoSubmitForm>
  )
}

function metricHref(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params)
  return `/admin/analytics?${searchParams.toString()}` as Route
}

export default async function AdminAnalyticsOverviewPage({ searchParams }: AdminAnalyticsOverviewPageProps) {
  const rawSearchParams = await searchParams
  const query = analyticsOverviewQuerySchema.parse(rawSearchParams)
  const data = await getAnalyticsOverview(query)
  const trendGranularityOptions = buildTrendGranularityOptions(rawSearchParams, data.trendGranularity)

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-neutral-500">数据分析 / 总览</p>
          <h1 className="text-3xl font-semibold tracking-tight">统计总览</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">左侧展示趋势、文章排行和最近访问，右侧展示关键时间段、来源地区和系统统计。单卡片时间范围不超过当前设置的 {data.retentionDays} 天。</p>
        </div>
        <div className="flex gap-2 text-sm"><a href="/admin/analytics" className="rounded-md border border-neutral-300 px-4 py-2 dark:border-neutral-700">筛选明细</a><a href="/admin/analytics/visitors" className="rounded-md border border-neutral-300 px-4 py-2 dark:border-neutral-700">访客统计</a></div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(22rem,0.9fr)]">
        <div className="min-w-0 space-y-6">
          <AnalyticsTrendChart
            title="全站访问趋势"
            description="可按天、周、月采样，默认按天。在图表右侧切换粒度。"
            trend={data.trend}
            granularityOptions={trendGranularityOptions}
            currentGranularity={data.trendGranularity}
            toolbar={(
              <AutoSubmitForm action="/admin/analytics/overview" className="flex flex-wrap items-center gap-2 text-sm">
                {Object.entries(rawSearchParams).map(([key, value]) => (
                  key !== 'trendRangeDays' && key !== 'trendGranularity' && value ? <input key={key} type="hidden" name={key} value={value} /> : null
                ))}
                <input type="hidden" name="trendGranularity" value={data.trendGranularity} />
                <select name="trendRangeDays" defaultValue={String(data.ranges.trend)} className="h-9 rounded-md border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-900">
                  {RANGE_DAY_OPTIONS.map((days) => <option key={days} value={days}>近 {days} 天</option>)}
                </select>
              </AutoSubmitForm>
            )}
          />

          <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">文章统计 Top 10</h2><p className="mt-1 text-sm text-neutral-500">按访问量从高到低排序。</p></div><RangeSelectForm paramKey="articlesRangeDays" currentParams={rawSearchParams} /></div>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-neutral-500"><tr><th className="py-2">文章</th><th className="py-2 text-right">访问量</th><th className="py-2 text-right">访问人数</th></tr></thead><tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">{data.topArticles.map((article) => <tr key={article.slug}><td className="py-3"><a href={metricHref({ dimension: 'article', slug: article.slug })} className="font-medium hover:text-blue-600">{article.label}</a><span className="mt-0.5 block font-mono text-xs text-neutral-500">{article.slug}</span></td><td className="py-3 text-right">{article.views}</td><td className="py-3 text-right">{article.visitors}</td></tr>)}{data.topArticles.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-neutral-500">暂无文章访问数据。</td></tr>}</tbody></table></div>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">最近 20 个访问记录</h2><p className="mt-1 text-sm text-neutral-500">按访问时间倒序。</p></div><RangeSelectForm paramKey="recentRangeDays" currentParams={rawSearchParams} /></div>
            <VisitRecordTable visits={data.recentVisits} />
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="font-semibold">全站访问量</h2>
            <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-900">{data.periodStats.map((stat) => <div key={stat.label} className="grid grid-cols-3 gap-3 py-3 text-sm"><span className="font-medium">{stat.label}</span><span className="text-right">{stat.views} 访问</span><span className="text-right text-neutral-500">{stat.visitors} 人</span></div>)}</div>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold">访问来源地区</h2><p className="mt-1 text-sm text-neutral-500">按国家分类 Top 5。</p></div><RangeSelectForm paramKey="sourcesRangeDays" currentParams={rawSearchParams} /></div>
            <div className="space-y-3">{data.topCountries.map((item) => <div key={item.label} className="flex justify-between gap-4 text-sm"><span>{item.label}</span><span className="text-neutral-500">{item.count}</span></div>)}{data.topCountries.length === 0 && <p className="text-sm text-neutral-500">暂无来源地区数据。</p>}</div>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold">访问系统</h2><p className="mt-1 text-sm text-neutral-500">操作系统 Top 5。</p></div><RangeSelectForm paramKey="systemsRangeDays" currentParams={rawSearchParams} /></div>
            <div className="space-y-3">{data.topSystems.map((item) => <div key={item.label} className="flex justify-between gap-4 text-sm"><span>{item.label}</span><span className="text-neutral-500">{item.count}</span></div>)}{data.topSystems.length === 0 && <p className="text-sm text-neutral-500">暂无系统数据。</p>}</div>
          </section>
        </div>
      </div>
    </div>
  )
}
