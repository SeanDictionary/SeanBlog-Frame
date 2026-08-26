import { ArticleStatus } from '@prisma/client'
import Link from 'next/link'
import type { Route } from 'next'

import { COMMENT_MODERATION_RULES_SETTING_KEY, normalizeCommentModerationRules } from '@/lib/comment-moderation-rules'
import { getPrisma } from '@/lib/prisma'
import { getSiteSettingsMap } from '@/lib/services/setting-service'

const SITE_ANALYTICS_RANGE_DAYS = 30

const COMMENT_STATUS_BADGES = {
  APPROVED: { label: '已通过', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  PENDING: { label: '待审核', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  SPAM: { label: '垃圾', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  TRASHED: { label: '已删除', className: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300' },
} as const

type StatColor = { bg: string; text: string }

const STAT_COLORS: Record<string, StatColor> = {
  drafts: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400' },
  articles: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400' },
  comments: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400' },
  views: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-600 dark:text-rose-400' },
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getLast30DaysTrend(events: Array<{ createdAt: Date; visitorId: string | null }>) {
  const end = addDays(startOfDay(new Date()), 1)
  const start = addDays(end, -SITE_ANALYTICS_RANGE_DAYS)
  const buckets = new Map<string, { date: string; views: number; visitors: Set<string> }>()

  for (let index = 0; index < SITE_ANALYTICS_RANGE_DAYS; index += 1) {
    const date = addDays(start, index)
    const key = formatDateKey(date)
    buckets.set(key, { date: key, views: 0, visitors: new Set<string>() })
  }

  for (const event of events) {
    const key = formatDateKey(event.createdAt)
    const bucket = buckets.get(key)
    if (!bucket) continue

    bucket.views += 1
    if (event.visitorId) bucket.visitors.add(event.visitorId)
  }

  return [...buckets.values()].map((bucket) => ({
    date: bucket.date,
    views: bucket.views,
    visitors: bucket.visitors.size,
  }))
}

function pickTopValue(values: Array<string | null>) {
  const buckets = new Map<string, number>()

  for (const value of values) {
    const normalized = value?.trim() || '未知'
    buckets.set(normalized, (buckets.get(normalized) ?? 0) + 1)
  }

  const [topValue] = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['暂无数据', 0]
  return topValue
}

function parseBrowser(userAgent: string | null) {
  if (!userAgent) return '未知'
  if (/Edg\//.test(userAgent)) return 'Edge'
  if (/Chrome\//.test(userAgent) && !/Chromium\//.test(userAgent)) return 'Chrome'
  if (/Firefox\//.test(userAgent)) return 'Firefox'
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return 'Safari'
  return '其他浏览器'
}

function parseOperatingSystem(userAgent: string | null) {
  if (!userAgent) return '未知'
  if (/Windows NT/.test(userAgent)) return 'Windows'
  if (/Mac OS X/.test(userAgent)) return 'macOS'
  if (/Android/.test(userAgent)) return 'Android'
  if (/(iPhone|iPad|iPod)/.test(userAgent)) return 'iOS'
  if (/Linux/.test(userAgent)) return 'Linux'
  return '其他系统'
}

function formatNumber(value: number | string | undefined) {
  return typeof value === 'number' ? value.toLocaleString('zh-CN') : value ?? '—'
}

type TrendPoint = { date: string; views: number; visitors: number }

function TrendChart({ points }: { points: TrendPoint[] }) {
  const width = 600
  const height = 160
  const padding = 10
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.views, point.visitors]))
  const buildPath = (key: 'views' | 'visitors') => points.map((point, index) => {
    const x = points.length > 1 ? (index / (points.length - 1)) * width : width / 2
    const y = height - padding - (point[key] / maxValue) * (height - padding * 2)
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="近 30 天访问量和访问人数趋势">
        <path d={buildPath('views')} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={buildPath('visitors')} fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mt-3 flex gap-4 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-blue-600" aria-hidden="true" />访问量</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-600" aria-hidden="true" />访问人数</span>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  href,
  colorKey,
  subtitle,
}: {
  icon: string
  label: string
  value: number | string
  href: Route
  colorKey: string
  subtitle?: string
}) {
  const color = STAT_COLORS[colorKey] ?? STAT_COLORS.views
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700"
    >
      <span className={`grid size-10 place-items-center rounded-lg ${color.bg} ${color.text}`}>
        <i className={icon} aria-hidden="true" />
      </span>
      <p className="mt-4 text-3xl font-semibold tracking-tight">{formatNumber(value)}</p>
      <p className="mt-1 text-sm text-neutral-500">{label}</p>
      {subtitle && <p className="mt-0.5 truncate text-xs text-neutral-400">{subtitle}</p>}
    </Link>
  )
}

function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export default async function AdminDashboardPage() {
  const prisma = getPrisma()
  const siteAnalyticsEnd = addDays(startOfDay(new Date()), 1)
  const siteAnalyticsStart = addDays(siteAnalyticsEnd, -SITE_ANALYTICS_RANGE_DAYS)
  const [
    articles,
    drafts,
    latestDraft,
    latestArticle,
    hottestArticles,
    articleHeatTotal,
    totalComments,
    pendingComments,
    totalViews,
    totalVisitors,
    recentAnalyticsEvents,
    recentCommentsRaw,
    settings,
  ] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: ArticleStatus.DRAFT } }),
    prisma.article.findFirst({
      where: { status: ArticleStatus.DRAFT },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true },
    }),
    prisma.article.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true },
    }),
    prisma.article.findMany({
      orderBy: [{ viewCount: 'desc' }, { updatedAt: 'desc' }],
      take: 6,
      select: { id: true, slug: true, title: true, viewCount: true },
    }),
    prisma.article.aggregate({ _sum: { viewCount: true } }),
    prisma.comment.count(),
    prisma.comment.count({ where: { status: 'PENDING' } }),
    prisma.analyticsDailyStat.aggregate({ where: { dimension: 'all' }, _sum: { views: true } }),
    prisma.visitor.count(),
    prisma.analyticsEvent.findMany({
      where: {
        createdAt: {
          gte: siteAnalyticsStart,
          lt: siteAnalyticsEnd,
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, visitorId: true, country: true, referrer: true, userAgent: true },
    }),
    prisma.comment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, content: true, status: true },
    }),
    getSiteSettingsMap(),
  ])

  const totalArticleHeat = articleHeatTotal._sum.viewCount ?? 0
  const siteViews = totalViews._sum.views ?? 0
  const commentAutoApprove = normalizeCommentModerationRules(settings[COMMENT_MODERATION_RULES_SETTING_KEY]).autoApprove
  const trend = getLast30DaysTrend(recentAnalyticsEvents)
  const maxHeat = Math.max(1, ...hottestArticles.map((article) => article.viewCount))

  const insights = [
    { label: '最多来源地区', value: pickTopValue(recentAnalyticsEvents.map((event) => event.country)) },
    { label: '最多操作系统', value: pickTopValue(recentAnalyticsEvents.map((event) => parseOperatingSystem(event.userAgent))) },
    { label: '最多浏览器', value: pickTopValue(recentAnalyticsEvents.map((event) => parseBrowser(event.userAgent))) },
    { label: '最多来源 URL', value: pickTopValue(recentAnalyticsEvents.map((event) => event.referrer)) },
  ]

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-neutral-500">后台概览</p>
          <h1 className="text-4xl font-semibold tracking-tight">欢迎回来</h1>
        </div>
        <Link
          href="/admin/articles/new"
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <i className="fa-solid fa-pen-to-square text-xs" aria-hidden="true" />
          新建文章
        </Link>
      </header>

      {/* Stat cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon="fa-regular fa-pen-to-square"
          label="草稿"
          value={drafts}
          href="/admin/articles?status=DRAFT"
          colorKey="drafts"
          subtitle={latestDraft ? `最新：${latestDraft.title}` : undefined}
        />
        <StatCard
          icon="fa-regular fa-file-lines"
          label="全部文章"
          value={articles}
          href="/admin/articles"
          colorKey="articles"
          subtitle={latestArticle ? `最新：${latestArticle.title}` : undefined}
        />
        <StatCard
          icon="fa-regular fa-comments"
          label="评论"
          value={totalComments}
          href="/admin/comments"
          colorKey="comments"
          subtitle={commentAutoApprove ? undefined : `${pendingComments} 条待审核`}
        />
        <StatCard
          icon="fa-solid fa-chart-pie"
          label="总访问量"
          value={siteViews}
          href="/admin/overview"
          colorKey="views"
          subtitle={`${totalVisitors.toLocaleString('zh-CN')} 位访问人数`}
        />
      </div>

      {/* Content: article heat + recent comments */}
      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel
          title="文章热度 Top 6"
          action={
            <Link href="/admin/articles?sort=viewCount&order=desc" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">
              查看全部
            </Link>
          }
        >
          {hottestArticles.length > 0 ? (
            <ul className="space-y-3">
              {hottestArticles.map((article, index) => (
                <li key={article.id}>
                  <Link
                    href={`/admin/articles/${article.id}/edit` as Route}
                    className="block rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-neutral-100 text-[0.625rem] font-semibold text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                          {index + 1}
                        </span>
                        <span className="min-w-0 truncate font-medium text-neutral-700 dark:text-neutral-200">{article.title}</span>
                      </span>
                      <span className="shrink-0 text-xs text-neutral-500">{article.viewCount.toLocaleString('zh-CN')} 热度</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
                      <div
                        className="h-full rounded-full bg-orange-500"
                        style={{ width: `${Math.max(8, (article.viewCount / maxHeat) * 100)}%` }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-5 text-center text-sm text-neutral-500 dark:border-neutral-800">
              暂无文章数据。
            </p>
          )}
        </Panel>

        <Panel
          title="最近评论"
          action={
            <Link href="/admin/comments" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">
              查看全部
            </Link>
          }
        >
          {recentCommentsRaw.length > 0 ? (
            <ul className="space-y-2">
              {recentCommentsRaw.map((comment) => {
                const badge = COMMENT_STATUS_BADGES[comment.status] ?? { label: comment.status, className: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300' }
                return (
                  <li key={comment.id}>
                    <Link
                      href="/admin/comments"
                      className="block rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className="min-w-0 truncate text-sm font-medium text-neutral-700 dark:text-neutral-200">
                          {comment.content}
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-5 text-center text-sm text-neutral-500 dark:border-neutral-800">
              暂无评论。
            </p>
          )}
        </Panel>
      </div>

      {/* Analytics: trend + insights */}
      <Panel
        title="近 30 天访问趋势"
        action={
          <Link href="/admin/overview" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">
            详细统计
          </Link>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <TrendChart points={trend} />
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((item) => (
              <Link
                key={item.label}
                href="/admin/overview"
                className="block rounded-lg bg-neutral-50 px-4 py-3 transition-colors hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800"
              >
                <p className="text-xs text-neutral-500">{item.label}</p>
                <p className="mt-1 truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{item.value}</p>
              </Link>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  )
}
