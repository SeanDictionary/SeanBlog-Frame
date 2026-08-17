import { ArticleStatus, CommentStatus, OperationLogResult } from '@prisma/client'
import { z } from 'zod'

import { ARTICLE_COMMENTS_MODES } from '@/lib/comment-settings'

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null))
  .nullable()
  .optional()

function emptyQueryParamToUndefined(value: unknown) {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

const optionalQueryString = z.preprocess(emptyQueryParamToUndefined, z.string().trim().min(1).optional())
const requiredQueryString = z.preprocess(emptyQueryParamToUndefined, z.string().trim().min(1).max(120))
const queryPage = z.preprocess(emptyQueryParamToUndefined, z.coerce.number().int().min(1).default(1))
const queryPageSize = z.preprocess(emptyQueryParamToUndefined, z.coerce.number().int().min(1).max(100).default(20))
const optionalArticleStatusQuery = z.preprocess(emptyQueryParamToUndefined, z.nativeEnum(ArticleStatus).optional())
const optionalCommentStatusQuery = z.preprocess(emptyQueryParamToUndefined, z.nativeEnum(CommentStatus).optional())
const optionalDateQuery = z.preprocess(emptyQueryParamToUndefined, z.coerce.date().optional())
export const publicArticleSortSchema = z.enum(['publishedAt', 'updatedAt', 'viewCount', 'commentCount'])
export const adminArticleSortSchema = z.enum(['updatedAt', 'publishedAt', 'createdAt', 'viewCount', 'visitorCount', 'title'])
const publicArticleSortQuery = z.preprocess(emptyQueryParamToUndefined, publicArticleSortSchema.default('publishedAt'))
const adminArticleSortQuery = z.preprocess(emptyQueryParamToUndefined, adminArticleSortSchema.default('updatedAt'))
const sortOrderQuery = z.preprocess(emptyQueryParamToUndefined, z.enum(['asc', 'desc']).default('desc'))

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const optionalSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(slugPattern, 'Slug must use lowercase letters, numbers, and dashes.')
  .optional()
const requiredSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(slugPattern, 'Slug must use lowercase letters, numbers, and dashes.')

const tagIdsSchema = z.array(z.string().trim().min(1))
const settingValueSchema = z
  .union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown()), z.array(z.unknown())])
  .refine((value) => JSON.stringify(value).length <= 100_000, 'Setting value must not exceed 100 KB when serialized.')

const optionalEmailString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().email().nullable().optional(),
)

export const paginationQuerySchema = z.object({
  page: queryPage,
  pageSize: queryPageSize,
})

export const articleListQuerySchema = paginationQuerySchema.extend({
  status: optionalArticleStatusQuery,
  category: optionalQueryString,
  tag: optionalQueryString,
  q: optionalQueryString,
  sort: adminArticleSortQuery,
  order: sortOrderQuery,
})

export const publicArticleListQuerySchema = paginationQuerySchema.extend({
  category: optionalQueryString,
  tag: optionalQueryString,
  sort: publicArticleSortQuery,
})

export const articleInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: requiredSlugSchema,
    excerpt: optionalTrimmedString,
    contentMarkdown: z.string().trim().min(1),
    coverImage: optionalTrimmedString,
    status: z.nativeEnum(ArticleStatus).default(ArticleStatus.DRAFT),
    commentsMode: z.enum(ARTICLE_COMMENTS_MODES).default('enabled'),
    metaTitle: optionalTrimmedString,
    metaDescription: optionalTrimmedString,
    metaKeywords: optionalTrimmedString,
    isPinned: z.boolean().default(false),
    categoryId: optionalTrimmedString,
    tagIds: tagIdsSchema.default([]),
    publishedAt: z.coerce.date().nullable().optional(),
    changeNote: optionalTrimmedString,
  })
  .strict()

export const articleUpdateSchema = articleInputSchema
  .omit({
    status: true,
    commentsMode: true,
    isPinned: true,
    tagIds: true,
  })
  .partial()
  .extend({
    status: z.nativeEnum(ArticleStatus).optional(),
    commentsMode: z.enum(ARTICLE_COMMENTS_MODES).optional(),
    isPinned: z.boolean().optional(),
    tagIds: tagIdsSchema.optional(),
  })
  .strict()

export const categoryInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    slug: optionalSlugSchema,
    description: optionalTrimmedString,
  })
  .strict()

export const categoryUpdateSchema = categoryInputSchema.partial().strict()

export const tagInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    slug: optionalSlugSchema,
    description: optionalTrimmedString,
  })
  .strict()

export const tagUpdateSchema = tagInputSchema.partial().strict()

export const taxonomyBulkDeleteSchema = z
  .object({
    ids: z.array(z.string().trim().min(1)).min(1).max(100),
  })
  .strict()

export const commentInputSchema = z
  .object({
    articleId: z.string().trim().min(1),
    content: z.string().trim().min(1).max(5000),
    guestName: optionalTrimmedString,
    guestEmail: optionalEmailString,
    parentId: optionalTrimmedString,
  })
  .strict()

export const commentListQuerySchema = paginationQuerySchema.extend({
  status: optionalCommentStatusQuery,
  articleId: optionalQueryString,
})

export const commentModerationSchema = z
  .object({
    status: z.nativeEnum(CommentStatus),
    isSpam: z.boolean().optional(),
  })
  .strict()

export const commentBulkActionSchema = z
  .object({
    ids: z.array(z.string().trim().min(1)).min(1).max(100),
    status: z.union([z.nativeEnum(CommentStatus), z.literal('DELETE')]),
  })
  .strict()

export const mediaInputSchema = z
  .object({
    filename: z.string().trim().min(1).max(255),
    url: z.string().trim().min(1).max(2048),
    key: z.string().trim().min(1).max(512),
    size: z.coerce.number().int().min(0),
    mimeType: z.string().trim().min(1).max(120),
    width: z.coerce.number().int().positive().nullable().optional(),
    height: z.coerce.number().int().positive().nullable().optional(),
  })
  .strict()

export const mediaBulkDeleteSchema = z
  .object({
    ids: z.array(z.string().trim().min(1)).min(1).max(100),
  })
  .strict()

export const settingInputSchema = z
  .object({
    value: settingValueSchema,
  })
  .strict()

const analyticsBooleanSettingKeys = new Set([
  'analyticsEnabled',
  'analyticsCollectIp',
  'analyticsCollectUserAgent',
  'analyticsCollectReferrer',
  'analyticsCollectFingerprint',
  'analyticsCollectHardware',
])
const analyticsSettingKeys = new Set([
  ...analyticsBooleanSettingKeys,
  'analyticsRetentionDays',
])
const articleMetaBooleanSettingKeys = new Set([
  'articleMetaShowPublishedAt',
  'articleMetaShowViewCount',
  'articleMetaShowReadingTime',
  'articleMetaShowWordCount',
  'articleMetaShowCategory',
  'articleMetaShowTags',
])
const articleMetaOrderSettingKey = 'articleMetaOrder'
const articleMetaItemIds = new Set([
  'publishedAt',
  'viewCount',
  'readingTime',
  'wordCount',
  'category',
  'tags',
])
const articleMetaSettingKeys = new Set([
  ...articleMetaBooleanSettingKeys,
  articleMetaOrderSettingKey,
])
const publicLayoutBooleanSettingKeys = new Set([
  'publicHeaderShowHome',
  'publicHeaderShowCategories',
  'publicHeaderShowTags',
  'publicHeaderShowSearch',
  'publicFooterShowRss',
])
const publicLayoutStringSettingKeys = new Set([
  'publicHeaderTitle',
  'publicFooterText',
])
const publicLayoutSettingKeys = new Set([
  ...publicLayoutBooleanSettingKeys,
  ...publicLayoutStringSettingKeys,
])

export const settingBulkUpdateSchema = z
  .object({
    scope: z.enum(['analytics', 'article-meta', 'public-layout']),
    updates: z.array(z.object({
      key: z.string().trim().min(1).max(120),
      value: settingValueSchema,
    }).strict()).min(1).max(50),
  })
  .strict()
  .superRefine((input, context) => {
    const seenKeys = new Set<string>()

    for (const [index, update] of input.updates.entries()) {
      if (seenKeys.has(update.key)) {
        context.addIssue({ code: 'custom', path: ['updates', index, 'key'], message: 'Duplicate setting key.' })
      }
      seenKeys.add(update.key)

      if (input.scope === 'analytics') {
        if (!analyticsSettingKeys.has(update.key)) {
          context.addIssue({ code: 'custom', path: ['updates', index, 'key'], message: 'Setting key is not allowed for analytics scope.' })
        } else if (analyticsBooleanSettingKeys.has(update.key) && typeof update.value !== 'boolean') {
          context.addIssue({ code: 'custom', path: ['updates', index, 'value'], message: 'Analytics collection settings must be boolean.' })
        } else if (update.key === 'analyticsRetentionDays' && (typeof update.value !== 'number' || !Number.isInteger(update.value) || update.value < 1 || update.value > 3650)) {
          context.addIssue({ code: 'custom', path: ['updates', index, 'value'], message: 'Analytics retention days must be an integer between 1 and 3650.' })
        }
      }

      if (input.scope === 'article-meta') {
        if (!articleMetaSettingKeys.has(update.key)) {
          context.addIssue({ code: 'custom', path: ['updates', index, 'key'], message: 'Setting key is not allowed for article metadata scope.' })
        } else if (articleMetaBooleanSettingKeys.has(update.key) && typeof update.value !== 'boolean') {
          context.addIssue({ code: 'custom', path: ['updates', index, 'value'], message: 'Article metadata visibility settings must be boolean.' })
        } else if (update.key === articleMetaOrderSettingKey) {
          const order = update.value
          const hasInvalidItem = !Array.isArray(order) || order.some((item) => typeof item !== 'string' || !articleMetaItemIds.has(item))
          const hasDuplicateItem = Array.isArray(order) && new Set(order).size !== order.length

          if (hasInvalidItem || hasDuplicateItem) {
            context.addIssue({ code: 'custom', path: ['updates', index, 'value'], message: 'Article metadata order is invalid.' })
          }
        }
      }

      if (input.scope === 'public-layout') {
        if (!publicLayoutSettingKeys.has(update.key)) {
          context.addIssue({ code: 'custom', path: ['updates', index, 'key'], message: 'Setting key is not allowed for public layout scope.' })
        } else if (publicLayoutBooleanSettingKeys.has(update.key) && typeof update.value !== 'boolean') {
          context.addIssue({ code: 'custom', path: ['updates', index, 'value'], message: 'Public layout toggle settings must be boolean.' })
        } else if (publicLayoutStringSettingKeys.has(update.key) && typeof update.value !== 'string') {
          context.addIssue({ code: 'custom', path: ['updates', index, 'value'], message: 'Public layout text settings must be strings.' })
        }
      }
    }
  })

export const markdownPreviewSchema = z
  .object({
    markdown: z.string().max(500_000),
  })
  .strict()

export const searchQuerySchema = paginationQuerySchema.extend({
  q: requiredQueryString,
})

export const categoryListQuerySchema = paginationQuerySchema

export const tagListQuerySchema = paginationQuerySchema

export const mediaListQuerySchema = paginationQuerySchema

export const articleBulkActionSchema = z
  .object({
    ids: z.array(z.string().trim().min(1)).min(1),
    action: z.enum(['publish', 'draft', 'archive', 'delete']),
  })
  .strict()

export const articleImportSchema = z
  .object({
    articles: z.array(articleInputSchema).min(1).max(100),
  })
  .strict()

export const analyticsEventSchema = z
  .object({
    path: z.string().trim().min(1).max(2048),
    contentType: z.enum(['page', 'article', 'category', 'tag']).default('page'),
    slug: optionalTrimmedString,
    sessionId: optionalTrimmedString,
    visitorId: optionalTrimmedString,
    referrer: optionalTrimmedString,
    browserFingerprint: optionalTrimmedString,
    hardware: optionalTrimmedString,
    durationSeconds: z.coerce.number().int().min(0).max(86400).nullable().optional(),
  })
  .strict()

export const analyticsQuerySchema = z.object({
  start: optionalDateQuery,
  end: optionalDateQuery,
  dimension: z.preprocess(emptyQueryParamToUndefined, z.enum(['all', 'article', 'category', 'tag']).default('all')),
  slug: optionalQueryString,
  granularity: z.preprocess(emptyQueryParamToUndefined, z.enum(['day', 'week', 'month']).default('day')),
})

export const analyticsOverviewQuerySchema = z.object({
  trendRangeDays: z.preprocess(emptyQueryParamToUndefined, z.coerce.number().int().min(1).default(30)),
  trendGranularity: z.preprocess(emptyQueryParamToUndefined, z.enum(['day', 'week', 'month']).default('day')),
  articlesRangeDays: z.preprocess(emptyQueryParamToUndefined, z.coerce.number().int().min(1).default(30)),
  recentRangeDays: z.preprocess(emptyQueryParamToUndefined, z.coerce.number().int().min(1).default(30)),
  sourcesRangeDays: z.preprocess(emptyQueryParamToUndefined, z.coerce.number().int().min(1).default(30)),
  systemsRangeDays: z.preprocess(emptyQueryParamToUndefined, z.coerce.number().int().min(1).default(30)),
})

export const analyticsVisitorQuerySchema = paginationQuerySchema.extend({
  pageSize: z.preprocess(emptyQueryParamToUndefined, z.coerce.number().int().refine((value) => [20, 50, 100].includes(value)).default(20)),
  start: optionalDateQuery,
  end: optionalDateQuery,
})

export const operationLogQuerySchema = paginationQuerySchema.extend({
  pageSize: z.preprocess(emptyQueryParamToUndefined, z.coerce.number().int().refine((value) => [20, 50, 100].includes(value)).default(20)),
  module: optionalQueryString,
  result: z.preprocess(emptyQueryParamToUndefined, z.nativeEnum(OperationLogResult).optional()),
  q: optionalQueryString,
})

export type PublicArticleSort = z.infer<typeof publicArticleSortSchema>
export type AdminArticleSort = z.infer<typeof adminArticleSortSchema>
export type ArticleInput = z.infer<typeof articleInputSchema>
export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>
export type CategoryInput = z.infer<typeof categoryInputSchema>
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>
export type TagInput = z.infer<typeof tagInputSchema>
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>
export type TaxonomyBulkDeleteInput = z.infer<typeof taxonomyBulkDeleteSchema>
export type CommentInput = z.infer<typeof commentInputSchema>
export type MediaInput = z.infer<typeof mediaInputSchema>
export type MarkdownPreviewInput = z.infer<typeof markdownPreviewSchema>
export type SettingBulkUpdateInput = z.infer<typeof settingBulkUpdateSchema>
export type ArticleBulkActionInput = z.infer<typeof articleBulkActionSchema>
export type ArticleImportInput = z.infer<typeof articleImportSchema>
export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
export type AnalyticsVisitorQuery = z.infer<typeof analyticsVisitorQuerySchema>
export type OperationLogQuery = z.infer<typeof operationLogQuerySchema>
