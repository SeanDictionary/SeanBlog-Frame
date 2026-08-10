import Link from 'next/link'
import type { Route } from 'next'
import type { ReactNode } from 'react'

import type { AnalyticsBucket, AnalyticsGranularity, AnalyticsTrendPoint, AnalyticsVisitRecord } from '@/lib/services/analytics-service'

type AnalyticsDashboardProps = {
  data: {
    range: { start: Date; end: Date }
    summary: {
      views: number
      visitors: number
      averageDurationSeconds: number
      events: number
    }
    trend: AnalyticsTrendPoint[]
    topArticles: AnalyticsBucket[]
    topCategories: AnalyticsBucket[]
    topTags: AnalyticsBucket[]
  }
  filters: {
    start?: string
    end?: string
    dimension: string
    slug?: string
    granularity: AnalyticsGranularity
  }
  exportHref: string
}

type VisitRecordTableProps = {
  visits: AnalyticsVisitRecord[]
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return '未知'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function linePath(points: AnalyticsTrendPoint[], key: 'views' | 'visitors', width: number, height: number) {
  if (!points.length) return ''
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.views, point.visitors]))
  const step = points.length > 1 ? width / (points.length - 1) : width

  return points.map((point, index) => {
    const x = points.length > 1 ? index * step : width / 2
    const y = height - (point[key] / maxValue) * height
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-neutral-500">{detail}</p>
    </article>
  )
}

function TopList({ title, items }: { title: string; items: AnalyticsBucket[] }) {
  const maxViews = Math.max(1, ...items.map((item) => item.views))

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? items.map((item) => (
          <div key={item.slug}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{item.label}</span>
              <span className="text-neutral-500">{item.views} / {item.visitors}</span>
            </div>
            <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-900">
              <div className="h-2 rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${Math.max(4, (item.views / maxViews) * 100)}%` }} />
            </div>
          </div>
        )) : <p className="text-sm text-neutral-500">暂无数据。</p>}
      </div>
    </section>
  )
}

export function AnalyticsTrendChart({ title, description, trend, toolbar }: { title?: string; description?: string; trend: AnalyticsTrendPoint[]; toolbar?: ReactNode }) {
  const width = 720
  const height = 220
  const viewsPath = linePath(trend, 'views', width, height)
  const visitorsPath = linePath(trend, 'visitors', width, height)

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      {(title || description || toolbar) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>{title && <h2 className="font-semibold">{title}</h2>}{description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}</div>
          {toolbar ?? <div className="flex gap-4 text-xs text-neutral-500"><span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-blue-600" />访问量</span><span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-amber-600" />访客数</span></div>}
        </div>
      )}
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="访问量和访客数趋势图" className="h-64 min-w-[42rem] w-full rounded-md bg-neutral-50 p-4 dark:bg-neutral-900">
          <path d={viewsPath} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
          <path d={visitorsPath} fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 6" />
        </svg>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm"><thead className="text-xs text-neutral-500"><tr><th className="py-2">时间</th><th className="py-2">访问量</th><th className="py-2">访客数</th></tr></thead><tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">{trend.map((point) => <tr key={point.date}><td className="py-2 font-mono text-xs">{point.date}</td><td className="py-2">{point.views}</td><td className="py-2">{point.visitors}</td></tr>)}</tbody></table>
      </div>
    </section>
  )
}

export function VisitRecordTable({ visits }: VisitRecordTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[64rem] text-left text-sm">
        <thead className="border-b border-neutral-100 text-xs text-neutral-500 dark:border-neutral-900">
          <tr><th className="py-2 pr-4">访问时间</th><th className="py-2 pr-4">访问时长</th><th className="py-2 pr-4">访问内容</th><th className="py-2 pr-4">地区 / IP</th><th className="py-2 pr-4">系统</th><th className="py-2 pr-4">浏览器</th><th className="py-2 pr-4">来源 URL</th></tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
          {visits.map((visit) => (
            <tr key={visit.id}>
              <td className="py-3 pr-4 font-mono text-xs">{visit.createdAt.toLocaleString('zh-CN')}</td>
              <td className="py-3 pr-4">{formatDuration(visit.durationSeconds)}</td>
              <td className="py-3 pr-4"><span className="block max-w-52 truncate font-medium">{visit.contentLabel}</span><span className="mt-0.5 block max-w-52 truncate font-mono text-xs text-neutral-500">{visit.contentSlug ?? visit.path}</span></td>
              <td className="py-3 pr-4"><span className="block">{visit.country ?? '未知'}</span><span className="mt-0.5 block font-mono text-xs text-neutral-500">{visit.ipAddress ?? '未采集'}</span></td>
              <td className="py-3 pr-4">{visit.operatingSystem}</td>
              <td className="py-3 pr-4">{visit.browser}</td>
              <td className="py-3 pr-4"><span className="block max-w-56 truncate text-neutral-500">{visit.referrer ?? '直接访问 / 未采集'}</span></td>
            </tr>
          ))}
          {visits.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-neutral-500">暂无访问记录。</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

export function AnalyticsDashboard({ data, filters, exportHref }: AnalyticsDashboardProps) {
  const startValue = filters.start ?? data.range.start.toISOString().slice(0, 10)
  const endValue = filters.end ?? new Date(data.range.end.getTime() - 1).toISOString().slice(0, 10)

  return (
    <div className="space-y-7">
      <form className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950 md:grid-cols-[repeat(6,minmax(0,1fr))_auto]" action="/admin/analytics">
        <label className="grid gap-1.5">开始日期<input name="start" type="date" defaultValue={startValue} className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <label className="grid gap-1.5">结束日期<input name="end" type="date" defaultValue={endValue} className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <label className="grid gap-1.5">粒度<select name="granularity" defaultValue={filters.granularity} className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900"><option value="day">天</option><option value="week">周</option><option value="month">月</option></select></label>
        <label className="grid gap-1.5">维度<select name="dimension" defaultValue={filters.dimension} className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900"><option value="all">全站</option><option value="article">文章</option><option value="category">分类</option><option value="tag">标签</option></select></label>
        <label className="grid gap-1.5 md:col-span-2">Slug<input name="slug" defaultValue={filters.slug ?? ''} placeholder="按文章/分类/标签 slug 筛选" className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <div className="flex items-end gap-2"><button className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950">应用</button><a href={exportHref} className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">导出 CSV</a></div>
      </form>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="访问量" value={data.summary.views} detail="当前筛选范围内事件数" />
        <StatCard label="访客数" value={data.summary.visitors} detail="基于匿名 visitor hash 去重" />
        <StatCard label="平均访问时长" value={formatDuration(data.summary.averageDurationSeconds)} detail="按有时长记录的事件计算" />
        <StatCard label="记录数" value={data.summary.events} detail="可导出的明细记录" />
      </section>

      <AnalyticsTrendChart title="按日期趋势" description="蓝色为访问量，橙色虚线为访客数。下方表格提供同一数据的文本视图。" trend={data.trend} />

      <div className="grid gap-5 xl:grid-cols-3">
        <TopList title="热门文章" items={data.topArticles} />
        <TopList title="热门分类" items={data.topCategories} />
        <TopList title="热门标签" items={data.topTags} />
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href={'/admin/analytics/overview' as Route} className="rounded-md border border-neutral-300 px-4 py-2 dark:border-neutral-700">查看统计总览</Link>
        <Link href={'/admin/analytics/visitors' as Route} className="rounded-md border border-neutral-300 px-4 py-2 dark:border-neutral-700">查看访客统计</Link>
      </div>
    </div>
  )
}
