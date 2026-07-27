import { ArticleStatus, CommentStatus } from '@prisma/client'
import { z } from 'zod'

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
const requiredQueryString = z.preprocess(emptyQueryParamToUndefined, z.string().trim().min(1))
const queryPage = z.preprocess(emptyQueryParamToUndefined, z.coerce.number().int().min(1).default(1))
const queryPageSize = z.preprocess(emptyQueryParamToUndefined, z.coerce.number().int().min(1).max(100).default(20))
const optionalArticleStatusQuery = z.preprocess(emptyQueryParamToUndefined, z.nativeEnum(ArticleStatus).optional())
const optionalCommentStatusQuery = z.preprocess(emptyQueryParamToUndefined, z.nativeEnum(CommentStatus).optional())

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase letters, numbers, and dashes.')
  .optional()

const tagIdsSchema = z.array(z.string().trim().min(1))

export const paginationQuerySchema = z.object({
  page: queryPage,
  pageSize: queryPageSize,
})

export const articleListQuerySchema = paginationQuerySchema.extend({
  status: optionalArticleStatusQuery,
  category: optionalQueryString,
  tag: optionalQueryString,
  q: optionalQueryString,
})

export const publicArticleListQuerySchema = paginationQuerySchema.extend({
  category: optionalQueryString,
  tag: optionalQueryString,
})

export const articleInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: slugSchema,
    excerpt: optionalTrimmedString,
    contentMarkdown: z.string().trim().min(1),
    coverImage: optionalTrimmedString,
    status: z.nativeEnum(ArticleStatus).default(ArticleStatus.DRAFT),
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
    isPinned: true,
    tagIds: true,
  })
  .partial()
  .extend({
    status: z.nativeEnum(ArticleStatus).optional(),
    isPinned: z.boolean().optional(),
    tagIds: tagIdsSchema.optional(),
  })
  .strict()

export const categoryInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    slug: slugSchema,
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
    slug: slugSchema,
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
    value: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown()), z.array(z.unknown())]),
  })
  .strict()

export const searchQuerySchema = paginationQuerySchema.extend({
  q: requiredQueryString,
})

export type ArticleInput = z.infer<typeof articleInputSchema>
export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>
export type CategoryInput = z.infer<typeof categoryInputSchema>
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>
export type TagInput = z.infer<typeof tagInputSchema>
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>
export type CommentInput = z.infer<typeof commentInputSchema>
export type MediaInput = z.infer<typeof mediaInputSchema>
