import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'

import { getPrisma } from '@/lib/prisma'
import { pageMeta, paginate } from '@/lib/services/shared'
import { getSiteSettingsMap } from '@/lib/services/setting-service'
import type { AnalyticsEventInput, AnalyticsQuery, AnalyticsVisitorQuery } from '@/lib/validations/cms'

export type AnalyticsGranularity = 'day' | 'week' | 'month'
export type AnalyticsTrendPoint = {
  date: string
  views: number
  visitors: number
}
export type AnalyticsBucket = {
  label: string
  slug: string
  views: number
  visitors: number
}
export type AnalyticsVisitRecord = {
  id: string
  createdAt: Date
  path: string
  contentType: string
  contentLabel: string
  contentSlug: string | null
  country: string | null
  ipAddress: string | null
  userAgent: string | null
  browser: string
  operatingSystem: string
  referrer: string | null
  durationSeconds: number | null
}

type RequestMetadata = {
  ipAddress?: string | null
  userAgent?: string | null
  country?: string | null
}

type AnalyticsSettings = {
  analyticsEnabled: boolean
  analyticsCollectIp: boolean
  analyticsCollectUserAgent: boolean
  analyticsCollectReferrer: boolean
  analyticsCollectFingerprint: boolean
  analyticsCollectHardware: boolean
  analyticsRetentionDays: number
}

type AnalyticsEventWithContent = Prisma.AnalyticsEventGetPayload<{
  include: {
    article: { select: { title: true; slug: true } }
    category: { select: { name: true; slug: true } }
    tag: { select: { name: true; slug: true } }
  }
}>

type OverviewOptions = {
  trendRangeDays: number
  trendGranularity: AnalyticsGranularity
  articlesRangeDays: number
  recentRangeDays: number
  sourcesRangeDays: number
  systemsRangeDays: number
}

const DEFAULT_RANGE_DAYS = 30
const DEFAULT_ANALYTICS_RETENTION_DAYS = 180
const MAX_ANALYTICS_RETENTION_DAYS = 3650

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function toNumber(value: unknown, fallback: number) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeSettings(settings: Record<string, unknown>): AnalyticsSettings {
  const retentionDays = Math.round(toNumber(settings.analyticsRetentionDays, DEFAULT_ANALYTICS_RETENTION_DAYS))

  return {
    analyticsEnabled: toBoolean(settings.analyticsEnabled, true),
    analyticsCollectIp: toBoolean(settings.analyticsCollectIp, false),
    analyticsCollectUserAgent: toBoolean(settings.analyticsCollectUserAgent, false),
    analyticsCollectReferrer: toBoolean(settings.analyticsCollectReferrer, false),
    analyticsCollectFingerprint: toBoolean(settings.analyticsCollectFingerprint, false),
    analyticsCollectHardware: toBoolean(settings.analyticsCollectHardware, false),
    analyticsRetentionDays: clamp(retentionDays, 1, MAX_ANALYTICS_RETENTION_DAYS),
  }
}

async function getAnalyticsSettings() {
  return normalizeSettings(await getSiteSettingsMap())
}

function hashValue(value?: string | null) {
  if (!value) return null
  return createHash('sha256').update(value).digest('hex')
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

function getWeekKey(date: Date) {
  const bucket = startOfDay(date)
  const day = bucket.getDay() || 7
  bucket.setDate(bucket.getDate() - day + 1)
  return formatDateKey(bucket)
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getGranularityKey(date: Date, granularity: AnalyticsGranularity) {
  if (granularity === 'week') return getWeekKey(date)
  if (granularity === 'month') return getMonthKey(date)
  return formatDateKey(date)
}

function getRange(query: AnalyticsQuery) {
  const end = query.end ? addDays(startOfDay(query.end), 1) : addDays(startOfDay(new Date()), 1)
  const start = query.start ? startOfDay(query.start) : addDays(end, -DEFAULT_RANGE_DAYS)

  return { start, end }
}

function getRangeForDays(days: number) {
  const end = addDays(startOfDay(new Date()), 1)
  return { start: addDays(end, -days), end }
}

function getYesterdayRange() {
  const today = startOfDay(new Date())
  return { start: addDays(today, -1), end: today }
}

function buildWhere(query: AnalyticsQuery): Prisma.AnalyticsEventWhereInput {
  const { start, end } = getRange(query)
  const where: Prisma.AnalyticsEventWhereInput = {
    createdAt: {
      gte: start,
      lt: end,
    },
  }

  if (query.dimension === 'article' && query.slug) {
    where.article = { slug: query.slug }
  }

  if (query.dimension === 'category' && query.slug) {
    where.category = { slug: query.slug }
  }

  if (query.dimension === 'tag' && query.slug) {
    where.tag = { slug: query.slug }
  }

  return where
}

function whereForDateRange(start?: Date, end?: Date): Prisma.AnalyticsEventWhereInput {
  if (!start && !end) return {}

  return {
    createdAt: {
      ...(start ? { gte: start } : {}),
      ...(end ? { lt: end } : {}),
    },
  }
}

async function resolveContent(input: AnalyticsEventInput) {
  const prisma = getPrisma()

  if (input.contentType === 'article' && input.slug) {
    const article = await prisma.article.findUnique({ where: { slug: input.slug }, select: { id: true, categoryId: true, tags: { select: { tagId: true } } } })
    return {
      articleId: article?.id ?? null,
      categoryId: article?.categoryId ?? null,
      tagId: article?.tags[0]?.tagId ?? null,
    }
  }

  if (input.contentType === 'category' && input.slug) {
    const category = await prisma.category.findUnique({ where: { slug: input.slug }, select: { id: true } })
    return { articleId: null, categoryId: category?.id ?? null, tagId: null }
  }

  if (input.contentType === 'tag' && input.slug) {
    const tag = await prisma.tag.findUnique({ where: { slug: input.slug }, select: { id: true } })
    return { articleId: null, categoryId: null, tagId: tag?.id ?? null }
  }

  return { articleId: null, categoryId: null, tagId: null }
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

const PAGE_LABELS: Record<string, string> = {
  '/': '首页',
  '/search': '搜索',
  '/login': '登录',
  '/categories': '分类列表',
  '/tags': '标签列表',
}

function getContentLabel(event: AnalyticsEventWithContent) {
  if (event.article) return event.article.title
  if (event.category) return event.category.name
  if (event.tag) return `#${event.tag.name}`
  const base = event.path.split('?')[0]
  return PAGE_LABELS[base] ?? event.path
}

function getContentSlug(event: AnalyticsEventWithContent) {
  return event.article?.slug ?? event.category?.slug ?? event.tag?.slug ?? null
}

function serializeVisitRecord(event: AnalyticsEventWithContent): AnalyticsVisitRecord {
  return {
    id: event.id,
    createdAt: event.createdAt,
    path: event.path,
    contentType: event.contentType,
    contentLabel: getContentLabel(event),
    contentSlug: getContentSlug(event),
    country: event.country,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    browser: parseBrowser(event.userAgent),
    operatingSystem: parseOperatingSystem(event.userAgent),
    referrer: event.referrer,
    durationSeconds: event.durationSeconds,
  }
}

function summarizeEvents(events: Array<{ visitorHash: string | null }>) {
  return {
    views: events.length,
    visitors: new Set(events.map((event) => event.visitorHash).filter(Boolean)).size,
  }
}

function topValues(values: string[], take = 5) {
  const buckets = new Map<string, number>()

  for (const rawValue of values) {
    const value = rawValue.trim() || '未知'
    buckets.set(value, (buckets.get(value) ?? 0) + 1)
  }

  return [...buckets.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-CN'))
    .slice(0, take)
}

function buildTrend(events: AnalyticsEventWithContent[], granularity: AnalyticsGranularity): AnalyticsTrendPoint[] {
  const buckets = new Map<string, { date: string; views: number; visitors: Set<string> }>()

  for (const event of events) {
    const key = getGranularityKey(event.createdAt, granularity)
    const bucket = buckets.get(key) ?? { date: key, views: 0, visitors: new Set<string>() }
    bucket.views += 1
    if (event.visitorHash) bucket.visitors.add(event.visitorHash)
    buckets.set(key, bucket)
  }

  return [...buckets.values()]
    .map((bucket) => ({ date: bucket.date, views: bucket.views, visitors: bucket.visitors.size }))
    .sort((left, right) => left.date.localeCompare(right.date))
}

function buildContentBuckets(events: AnalyticsEventWithContent[]) {
  const byArticle = new Map<string, { label: string; slug: string; views: number; visitors: Set<string> }>()
  const byCategory = new Map<string, { label: string; slug: string; views: number; visitors: Set<string> }>()
  const byTag = new Map<string, { label: string; slug: string; views: number; visitors: Set<string> }>()

  for (const event of events) {
    if (event.article) {
      const bucket = byArticle.get(event.article.slug) ?? { label: event.article.title, slug: event.article.slug, views: 0, visitors: new Set<string>() }
      bucket.views += 1
      if (event.visitorHash) bucket.visitors.add(event.visitorHash)
      byArticle.set(event.article.slug, bucket)
    }

    if (event.category) {
      const bucket = byCategory.get(event.category.slug) ?? { label: event.category.name, slug: event.category.slug, views: 0, visitors: new Set<string>() }
      bucket.views += 1
      if (event.visitorHash) bucket.visitors.add(event.visitorHash)
      byCategory.set(event.category.slug, bucket)
    }

    if (event.tag) {
      const bucket = byTag.get(event.tag.slug) ?? { label: event.tag.name, slug: event.tag.slug, views: 0, visitors: new Set<string>() }
      bucket.views += 1
      if (event.visitorHash) bucket.visitors.add(event.visitorHash)
      byTag.set(event.tag.slug, bucket)
    }
  }

  const serializeBucket = (bucket: { label: string; slug: string; views: number; visitors: Set<string> }) => ({
    label: bucket.label,
    slug: bucket.slug,
    views: bucket.views,
    visitors: bucket.visitors.size,
  })
  const sortBuckets = (items: AnalyticsBucket[], take: number) => items.sort((left, right) => right.views - left.views || left.label.localeCompare(right.label, 'zh-CN')).slice(0, take)

  return {
    topArticles: sortBuckets([...byArticle.values()].map(serializeBucket), 10),
    topCategories: sortBuckets([...byCategory.values()].map(serializeBucket), 8),
    topTags: sortBuckets([...byTag.values()].map(serializeBucket), 8),
  }
}

export async function createAnalyticsEvent(input: AnalyticsEventInput, metadata: RequestMetadata) {
  const settings = await getAnalyticsSettings()

  if (!settings.analyticsEnabled) {
    return { skipped: true as const }
  }

  const content = await resolveContent(input)
  const visitorHash = hashValue(input.visitorId ?? input.sessionId ?? null)
  const isNewArticleVisitor = content.articleId && visitorHash
    ? await getPrisma().analyticsEvent.count({ where: { articleId: content.articleId, visitorHash } }).then((count) => count === 0)
    : false

  const event = await getPrisma().analyticsEvent.create({
    data: {
      path: input.path,
      contentType: input.contentType,
      ...content,
      visitorHash,
      sessionId: input.sessionId,
      referrer: settings.analyticsCollectReferrer ? input.referrer : null,
      country: metadata.country ?? null,
      ipAddress: settings.analyticsCollectIp ? metadata.ipAddress : null,
      userAgent: settings.analyticsCollectUserAgent ? metadata.userAgent : null,
      browserFingerprint: settings.analyticsCollectFingerprint ? input.browserFingerprint : null,
      hardware: settings.analyticsCollectHardware ? input.hardware : null,
      durationSeconds: input.durationSeconds,
    },
  })

  if (content.articleId) {
    await getPrisma().article.update({
      where: { id: content.articleId },
      data: {
        viewCount: { increment: 1 },
        ...(isNewArticleVisitor ? { visitorCount: { increment: 1 } } : {}),
      },
    }).catch(() => undefined)
  }

  return { skipped: false as const, event }
}

export async function getAnalyticsDashboard(query: AnalyticsQuery) {
  const prisma = getPrisma()
  const where = buildWhere(query)
  const events = await prisma.analyticsEvent.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      article: { select: { title: true, slug: true } },
      category: { select: { name: true, slug: true } },
      tag: { select: { name: true, slug: true } },
    },
  })
  const visitorIds = new Set(events.map((event) => event.visitorHash).filter(Boolean))
  const durations = events.map((event) => event.durationSeconds).filter((value): value is number => typeof value === 'number')
  const totalDuration = durations.reduce((sum, value) => sum + value, 0)
  const buckets = buildContentBuckets(events)

  return {
    range: getRange(query),
    summary: {
      views: events.length,
      visitors: visitorIds.size,
      averageDurationSeconds: durations.length ? Math.round(totalDuration / durations.length) : 0,
      events: events.length,
    },
    trend: buildTrend(events, query.granularity),
    ...buckets,
    events,
  }
}

export async function getAnalyticsOverview(options: OverviewOptions) {
  const prisma = getPrisma()
  const settings = await getAnalyticsSettings()
  const retentionDays = settings.analyticsRetentionDays
  const normalizeRange = (days: number) => clamp(Math.round(days), 1, retentionDays)
  const trendRange = getRangeForDays(normalizeRange(options.trendRangeDays))
  const articlesRange = getRangeForDays(normalizeRange(options.articlesRangeDays))
  const recentRange = getRangeForDays(normalizeRange(options.recentRangeDays))
  const sourcesRange = getRangeForDays(normalizeRange(options.sourcesRangeDays))
  const systemsRange = getRangeForDays(normalizeRange(options.systemsRangeDays))
  const currentYearStart = new Date(startOfDay(new Date()).getFullYear(), 0, 1)
  const [trendEvents, articleEvents, recentEvents, sourceEvents, systemEvents, allEvents, currentYearEvents, todayEvents, yesterdayEvents, sevenDayEvents, thirtyDayEvents, ninetyDayEvents, retentionEvents] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: whereForDateRange(trendRange.start, trendRange.end),
      orderBy: { createdAt: 'asc' },
      include: { article: { select: { title: true, slug: true } }, category: { select: { name: true, slug: true } }, tag: { select: { name: true, slug: true } } },
    }),
    prisma.analyticsEvent.findMany({
      where: whereForDateRange(articlesRange.start, articlesRange.end),
      include: { article: { select: { title: true, slug: true } }, category: { select: { name: true, slug: true } }, tag: { select: { name: true, slug: true } } },
    }),
    prisma.analyticsEvent.findMany({
      where: whereForDateRange(recentRange.start, recentRange.end),
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { article: { select: { title: true, slug: true } }, category: { select: { name: true, slug: true } }, tag: { select: { name: true, slug: true } } },
    }),
    prisma.analyticsEvent.findMany({ where: whereForDateRange(sourcesRange.start, sourcesRange.end), select: { country: true, visitorHash: true } }),
    prisma.analyticsEvent.findMany({ where: whereForDateRange(systemsRange.start, systemsRange.end), select: { userAgent: true, visitorHash: true } }),
    prisma.analyticsEvent.findMany({ select: { visitorHash: true } }),
    prisma.analyticsEvent.findMany({ where: whereForDateRange(currentYearStart), select: { visitorHash: true } }),
    prisma.analyticsEvent.findMany({ where: whereForDateRange(startOfDay(new Date()), addDays(startOfDay(new Date()), 1)), select: { visitorHash: true } }),
    prisma.analyticsEvent.findMany({ where: whereForDateRange(getYesterdayRange().start, getYesterdayRange().end), select: { visitorHash: true } }),
    prisma.analyticsEvent.findMany({ where: whereForDateRange(getRangeForDays(7).start, getRangeForDays(7).end), select: { visitorHash: true } }),
    prisma.analyticsEvent.findMany({ where: whereForDateRange(getRangeForDays(30).start, getRangeForDays(30).end), select: { visitorHash: true } }),
    prisma.analyticsEvent.findMany({ where: whereForDateRange(getRangeForDays(90).start, getRangeForDays(90).end), select: { visitorHash: true } }),
    prisma.analyticsEvent.findMany({ where: whereForDateRange(getRangeForDays(retentionDays).start, getRangeForDays(retentionDays).end), select: { visitorHash: true } }),
  ])

  return {
    retentionDays,
    ranges: {
      trend: normalizeRange(options.trendRangeDays),
      articles: normalizeRange(options.articlesRangeDays),
      recent: normalizeRange(options.recentRangeDays),
      sources: normalizeRange(options.sourcesRangeDays),
      systems: normalizeRange(options.systemsRangeDays),
    },
    trend: buildTrend(trendEvents, options.trendGranularity),
    trendGranularity: options.trendGranularity,
    topArticles: buildContentBuckets(articleEvents).topArticles,
    recentVisits: recentEvents.map(serializeVisitRecord),
    periodStats: [
      { label: '今天', ...summarizeEvents(todayEvents) },
      { label: '昨天', ...summarizeEvents(yesterdayEvents) },
      { label: '近 7 天', ...summarizeEvents(sevenDayEvents) },
      { label: '近 30 天', ...summarizeEvents(thirtyDayEvents) },
      { label: '近 90 天', ...summarizeEvents(ninetyDayEvents) },
      { label: `近 ${retentionDays} 天`, ...summarizeEvents(retentionEvents) },
      { label: '今年', ...summarizeEvents(currentYearEvents) },
      { label: '有史以来', ...summarizeEvents(allEvents) },
    ],
    topCountries: topValues(sourceEvents.map((event) => event.country ?? '未知')),
    topSystems: topValues(systemEvents.map((event) => parseOperatingSystem(event.userAgent))),
  }
}

export async function getAnalyticsVisitors(query: AnalyticsVisitorQuery) {
  const prisma = getPrisma()
  const where = whereForDateRange(query.start ? startOfDay(query.start) : undefined, query.end ? addDays(startOfDay(query.end), 1) : undefined)
  const [items, total] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where,
      ...paginate(query.page, query.pageSize),
      orderBy: { createdAt: 'desc' },
      include: {
        article: { select: { title: true, slug: true } },
        category: { select: { name: true, slug: true } },
        tag: { select: { name: true, slug: true } },
      },
    }),
    prisma.analyticsEvent.count({ where }),
  ])

  return {
    items: items.map(serializeVisitRecord),
    meta: pageMeta(total, query.page, query.pageSize),
  }
}

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function visitToCsvRow(visit: AnalyticsVisitRecord) {
  return [
    visit.createdAt.toISOString(),
    visit.path,
    visit.contentType,
    visit.contentLabel,
    visit.country ?? '',
    visit.ipAddress ?? '',
    visit.operatingSystem,
    visit.browser,
    visit.durationSeconds ?? '',
    visit.referrer ?? '',
    visit.userAgent ?? '',
  ]
}

export async function exportAnalyticsCsv(query: AnalyticsQuery) {
  const dashboard = await getAnalyticsDashboard(query)
  const rows = [
    ['createdAt', 'path', 'contentType', 'article', 'category', 'tag', 'visitorHash', 'durationSeconds', 'referrer', 'ipAddress', 'userAgent', 'browserFingerprint', 'hardware'],
    ...dashboard.events.map((event) => [
      event.createdAt.toISOString(),
      event.path,
      event.contentType,
      event.article?.title ?? '',
      event.category?.name ?? '',
      event.tag?.name ?? '',
      event.visitorHash ?? '',
      event.durationSeconds ?? '',
      event.referrer ?? '',
      event.ipAddress ?? '',
      event.userAgent ?? '',
      event.browserFingerprint ?? '',
      event.hardware ?? '',
    ]),
  ]

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
}

export async function exportAnalyticsVisitorsCsv(query: AnalyticsVisitorQuery) {
  const settings = await getAnalyticsSettings()
  const end = query.end ? addDays(startOfDay(query.end), 1) : addDays(startOfDay(new Date()), 1)
  const start = query.start ? startOfDay(query.start) : addDays(end, -settings.analyticsRetentionDays)
  const result = await getAnalyticsVisitors({ ...query, start, end, page: 1, pageSize: 10000 })
  const rows = [
    ['createdAt', 'path', 'contentType', 'content', 'country', 'ipAddress', 'operatingSystem', 'browser', 'durationSeconds', 'referrer', 'userAgent'],
    ...result.items.map(visitToCsvRow),
  ]

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
}
