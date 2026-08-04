import { ArticleStatus, CommentStatus } from '@prisma/client'
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
    expiresAt: z.coerce.date().nullable().optional(),
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
    sortOrder: z.coerce.number().int().default(0),
  })
  .strict()

export const categoryUpdateSchema = categoryInputSchema
  .omit({ sortOrder: true })
  .partial()
  .extend({
    sortOrder: z.coerce.number().int().optional(),
  })
  .strict()

export const tagInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    slug: optionalSlugSchema,
  })
  .strict()

export const tagUpdateSchema = tagInputSchema.partial().strict()

export const commentInputSchema = z
  .object({
    articleId: z.string().trim().min(1),
    content: z.string().trim().min(1).max(5000),
    guestName: optionalTrimmedString,
    guestEmail: z.string().trim().email().nullable().optional(),
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

export const settingInputSchema = z
  .object({
    value: settingValueSchema,
  })
  .strict()

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
})

export type PublicArticleSort = z.infer<typeof publicArticleSortSchema>
export type AdminArticleSort = z.infer<typeof adminArticleSortSchema>
export type ArticleInput = z.infer<typeof articleInputSchema>
export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>
export type CategoryInput = z.infer<typeof categoryInputSchema>
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>
export type TagInput = z.infer<typeof tagInputSchema>
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>
export type CommentInput = z.infer<typeof commentInputSchema>
export type MediaInput = z.infer<typeof mediaInputSchema>
export type MarkdownPreviewInput = z.infer<typeof markdownPreviewSchema>
export type ArticleBulkActionInput = z.infer<typeof articleBulkActionSchema>
export type ArticleImportInput = z.infer<typeof articleImportSchema>
export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
