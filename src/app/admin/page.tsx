import { ArticleStatus } from '@prisma/client'
import type { Route } from 'next'

import { DashboardManager } from '@/components/admin/dashboard-manager'
import { COMMENT_MODERATION_RULES_SETTING_KEY, normalizeCommentModerationRules } from '@/lib/comment-moderation-rules'
import { getPrisma } from '@/lib/prisma'
import { getSiteSettingsMap } from '@/lib/services/setting-service'

const SITE_ANALYTICS_RANGE_DAYS = 30

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

function buildAnalyticsHref() {
  return '/admin/overview' as Route
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
    allAnalyticsEvents,
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
    prisma.analyticsEvent.findMany({
      select: { visitorId: true, country: true, referrer: true, userAgent: true },
    }),
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
      take: 3,
      select: { id: true, content: true, status: true },
    }),
    getSiteSettingsMap(),
  ])

  const totalArticleHeat = articleHeatTotal._sum.viewCount ?? 0
  const totalVisitors = new Set(allAnalyticsEvents.map((event) => event.visitorId).filter(Boolean)).size
  const commentAutoApprove = normalizeCommentModerationRules(settings[COMMENT_MODERATION_RULES_SETTING_KEY]).autoApprove
  const recentComments = commentAutoApprove
    ? recentCommentsRaw.map((comment) => ({
        id: comment.id,
        content: comment.content,
        status: comment.status,
        href: '/admin/comments' as const,
      }))
    : []
  const stats = [
    {
      key: 'drafts',
      label: '草稿',
      value: drafts,
      icon: 'fa-regular fa-pen-to-square',
      href: '/admin/articles?status=DRAFT' as const,
      secondaryLabel: latestDraft?.title || '未命名',
      secondaryHref: latestDraft ? `/admin/articles/${latestDraft.id}/edit` as Route : '/admin/articles?status=DRAFT' as const,
    },
    {
      key: 'articles',
      label: '全部文章',
      value: articles,
      icon: 'fa-regular fa-file-lines',
      href: '/admin/articles' as const,
      secondaryLabel: latestArticle?.title || '未命名',
      secondaryHref: latestArticle ? `/admin/articles/${latestArticle.id}/edit` as Route : '/admin/articles' as const,
    },
    {
      key: 'articleHeat',
      label: '文章热度',
      value: totalArticleHeat,
      icon: 'fa-solid fa-fire',
      href: '/admin/articles?sort=viewCount&order=desc' as const,
      listItems: hottestArticles.map((article) => ({
        title: article.title,
        detail: `${article.viewCount.toLocaleString('zh-CN')} 热度`,
        href: `/admin/overview` as Route,
      })),
    },
    {
      key: 'comments',
      label: '评论',
      icon: 'fa-regular fa-comments',
      href: '/admin/comments' as const,
      ...(commentAutoApprove
        ? {
            value: totalComments.toLocaleString('zh-CN'),
            recentComments,
          }
        : {
            insights: [
              { label: '评论总数', value: totalComments.toLocaleString('zh-CN'), href: '/admin/comments' as const },
              { label: '待审核评论', value: pendingComments.toLocaleString('zh-CN'), href: '/admin/comments?status=PENDING' as const },
            ],
          }),
    },
    {
      key: 'quickCreateArticle',
      label: '新建文章',
      icon: 'fa-solid fa-pen-to-square',
      href: '/admin/articles/new' as const,
    },
    {
      key: 'siteAnalytics',
      label: '总访问量',
      value: allAnalyticsEvents.length,
      icon: 'fa-solid fa-chart-pie',
      href: '/admin/overview' as const,
      trend: getLast30DaysTrend(recentAnalyticsEvents),
      insights: [
        { label: '最多来源地区', value: pickTopValue(recentAnalyticsEvents.map((event) => event.country)), href: buildAnalyticsHref() },
        { label: '最多操作系统', value: pickTopValue(recentAnalyticsEvents.map((event) => parseOperatingSystem(event.userAgent))), href: buildAnalyticsHref() },
        { label: '最多浏览器', value: pickTopValue(recentAnalyticsEvents.map((event) => parseBrowser(event.userAgent))), href: buildAnalyticsHref() },
        { label: '最多来源 URL', value: pickTopValue(recentAnalyticsEvents.map((event) => event.referrer)), href: buildAnalyticsHref() },
      ],
      secondaryLabel: `${totalVisitors.toLocaleString('zh-CN')} 位访问人数`,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-3">
        <p className="mb-2 text-sm text-neutral-500">后台概览</p>
        <h1 className="text-4xl font-semibold tracking-tight">欢迎回来</h1>
      </header>

      <DashboardManager cards={stats} initialLayout={settings.adminDashboardCards} />
    </div>
  )
}
