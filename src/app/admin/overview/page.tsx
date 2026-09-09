import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'

import { AutoSubmitForm } from '@/components/common/auto-submit-form'
import { AnalyticsTrendChart, type AnalyticsGranularityOption } from '@/components/admin/analytics-trend-chart'
import { VisitRecordTable } from '@/components/admin/analytics-dashboard'
import { Card, CardHeader } from '@/components/ui/card'
import type { AnalyticsGranularity } from '@/lib/services/analytics-service'
import { getAnalyticsOverview } from '@/lib/services/analytics-service'
import { analyticsOverviewQuerySchema } from '@/lib/validations/cms'
export const metadata: Metadata = {
  title: '统计总览',
}


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
    return { value: option.value, label: option.label, href: `/admin/overview?${search.toString()}` as Route }
  })
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
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">左侧展示趋势、文章排行和最近访问，右侧展示关键时间段、来源地区和系统统计。</p>
        </div>
        <AutoSubmitForm key="overview-range-form" action="/admin/overview" className="flex items-center gap-2 text-sm">
          {Object.entries(rawSearchParams).map(([key, value]) => (
            key !== 'rangeDays' && key !== 'trendGranularity' && value ? <input key={key} type="hidden" name={key} value={value} /> : null
          ))}
          <input type="hidden" name="trendGranularity" value={data.trendGranularity} />
          <label htmlFor="overview-range-days" className="text-neutral-500">时间范围</label>
          <select id="overview-range-days" name="rangeDays" defaultValue={String(data.range)} className="h-9 rounded-md border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-900">
            {RANGE_DAY_OPTIONS.map((days) => <option key={days} value={days}>近 {days} 天</option>)}
          </select>
        </AutoSubmitForm>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(22rem,0.9fr)]">
        <div className="min-w-0 space-y-6">
          <AnalyticsTrendChart
            title="全站访问趋势"
            description="可选不同粒度按天、周、月采样，默认按天"
            trend={data.trend}
            granularityOptions={trendGranularityOptions}
            currentGranularity={data.trendGranularity}
          />

          <Card>
            <CardHeader title="最近访问记录" description="按访问时间倒序" />
            <VisitRecordTable visits={data.recentVisits} tiny />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <h2 className="font-semibold">全站访问量</h2>
            <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-900">{data.periodStats.map((stat) => <div key={stat.label} className="grid grid-cols-3 gap-3 py-3 text-sm"><span className="font-medium">{stat.label}</span><span className="text-right">{stat.views} 访问</span><span className="text-right text-neutral-500">{stat.visitors} 人</span></div>)}</div>
          </Card>

          <Card>
            <CardHeader title="文章统计 Top 10" description="按访问量从高到低排序" />
            <div className="overflow-x-auto -mx-5"><table className="w-full text-left text-sm"><thead className="text-xs text-neutral-500"><tr><th className="py-2 pl-5 pr-4">文章</th><th className="py-2 pr-4 text-right">访问量</th><th className="py-2 pr-5 text-right">访问人数</th></tr></thead><tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">{data.topArticles.map((article) => <tr key={article.slug}><td className="py-3 pl-5 pr-4"><Link href={`/articles/${article.slug}` as Route} className="block max-w-52 truncate font-medium">{article.label}</Link><p className="mt-0.5 flex items-center gap-2 font-mono text-xs text-neutral-500"><span className="max-w-48 truncate">{article.slug}</span><a href={`/articles/${article.slug}`} target="_blank" rel="noreferrer" className="shrink-0 text-neutral-400 transition-colors hover:text-neutral-950 dark:hover:text-neutral-50" aria-label="在新窗口打开文章"><i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /></a></p></td><td className="py-3 pr-4 text-right">{article.views}</td><td className="py-3 pr-5 text-right">{article.visitors}</td></tr>)}{data.topArticles.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-neutral-500">暂无文章访问数据。</td></tr>}</tbody></table></div>
          </Card>

          <Card>
            <CardHeader title="访问来源地区" description="按国家分类 Top 5" />
            <div className="space-y-3">{data.topCountries.map((item) => <div key={item.label} className="flex justify-between gap-4 text-sm"><span>{item.label}</span><span className="text-neutral-500">{item.count}</span></div>)}{data.topCountries.length === 0 && <p className="text-sm text-neutral-500">暂无来源地区数据。</p>}</div>
          </Card>

          <Card>
            <CardHeader title="访问系统" description="操作系统 Top 5" />
            <div className="space-y-3">{data.topSystems.map((item) => <div key={item.label} className="flex justify-between gap-4 text-sm"><span>{item.label}</span><span className="text-neutral-500">{item.count}</span></div>)}{data.topSystems.length === 0 && <p className="text-sm text-neutral-500">暂无系统数据。</p>}</div>
          </Card>
        </div>
      </div>
    </div>
  )
}
