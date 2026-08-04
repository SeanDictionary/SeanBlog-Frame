import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'

import { getPrisma } from '@/lib/prisma'
import { getSiteSettingsMap } from '@/lib/services/setting-service'
import type { AnalyticsEventInput, AnalyticsQuery } from '@/lib/validations/cms'

const DEFAULT_RANGE_DAYS = 30

type RequestMetadata = {
  ipAddress?: string | null
  userAgent?: string | null
}

type AnalyticsSettings = {
  analyticsEnabled: boolean
  analyticsCollectIp: boolean
  analyticsCollectUserAgent: boolean
  analyticsCollectReferrer: boolean
  analyticsCollectFingerprint: boolean
  analyticsCollectHardware: boolean
}

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeSettings(settings: Record<string, unknown>): AnalyticsSettings {
  return {
    analyticsEnabled: toBoolean(settings.analyticsEnabled, true),
    analyticsCollectIp: toBoolean(settings.analyticsCollectIp, false),
    analyticsCollectUserAgent: toBoolean(settings.analyticsCollectUserAgent, false),
    analyticsCollectReferrer: toBoolean(settings.analyticsCollectReferrer, false),
    analyticsCollectFingerprint: toBoolean(settings.analyticsCollectFingerprint, false),
    analyticsCollectHardware: toBoolean(settings.analyticsCollectHardware, false),
  }
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

function getRange(query: AnalyticsQuery) {
  const end = query.end ? addDays(startOfDay(query.end), 1) : addDays(startOfDay(new Date()), 1)
  const start = query.start ? startOfDay(query.start) : addDays(end, -DEFAULT_RANGE_DAYS)

  return { start, end }
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

export async function createAnalyticsEvent(input: AnalyticsEventInput, metadata: RequestMetadata) {
  const settings = normalizeSettings(await getSiteSettingsMap())

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
      ipAddress: settings.analyticsCollectIp ? metadata.ipAddress : null,
      userAgent: settings.analyticsCollectUserAgent ? metadata.userAgent : null,
      browserFingerprint: settings.analyticsCollectFingerprint ? input.browserFingerprint : null,
      hardware: settings.analyticsCollectHardware ? input.hardware : null,
      durationSeconds: input.durationSeconds,
    },
  })

  if (content.articleId && isNewArticleVisitor) {
    await getPrisma().article.update({
      where: { id: content.articleId },
      data: {
        visitorCount: { increment: 1 },
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
  const byDate = new Map<string, { date: string; views: number; visitors: Set<string> }>()
  const byArticle = new Map<string, { label: string; slug: string; views: number; visitors: Set<string> }>()
  const byCategory = new Map<string, { label: string; slug: string; views: number; visitors: Set<string> }>()
  const byTag = new Map<string, { label: string; slug: string; views: number; visitors: Set<string> }>()

  for (const event of events) {
    const date = event.createdAt.toISOString().slice(0, 10)
    const dateBucket = byDate.get(date) ?? { date, views: 0, visitors: new Set<string>() }
    dateBucket.views += 1
    if (event.visitorHash) dateBucket.visitors.add(event.visitorHash)
    byDate.set(date, dateBucket)

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

  return {
    range: getRange(query),
    summary: {
      views: events.length,
      visitors: visitorIds.size,
      averageDurationSeconds: durations.length ? Math.round(totalDuration / durations.length) : 0,
      events: events.length,
    },
    trend: [...byDate.values()].map((bucket) => ({ date: bucket.date, views: bucket.views, visitors: bucket.visitors.size })),
    topArticles: [...byArticle.values()].map(serializeBucket).sort((a, b) => b.views - a.views).slice(0, 8),
    topCategories: [...byCategory.values()].map(serializeBucket).sort((a, b) => b.views - a.views).slice(0, 8),
    topTags: [...byTag.values()].map(serializeBucket).sort((a, b) => b.views - a.views).slice(0, 8),
    events,
  }
}

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export async function exportAnalyticsCsv(query: AnalyticsQuery) {
  const dashboard = await getAnalyticsDashboard(query)
  const rows = [
    ['createdAt', 'path', 'contentType', 'article', 'category', 'tag', 'viewsVisitorHash', 'durationSeconds', 'referrer', 'ipAddress', 'userAgent', 'browserFingerprint', 'hardware'],
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
