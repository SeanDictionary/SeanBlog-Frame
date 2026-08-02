import { ArticleCommentsMode as PrismaArticleCommentsMode } from '@prisma/client'

export const ARTICLE_COMMENTS_MODES = ['enabled', 'readOnly', 'disabled'] as const

export type ArticleCommentsMode = (typeof ARTICLE_COMMENTS_MODES)[number]

export function isArticleCommentsMode(value: unknown): value is ArticleCommentsMode {
  return typeof value === 'string' && ARTICLE_COMMENTS_MODES.includes(value as ArticleCommentsMode)
}

export function resolveArticleCommentsMode(value: unknown): ArticleCommentsMode {
  return isArticleCommentsMode(value) ? value : 'enabled'
}

export function canDisplayArticleComments(mode: ArticleCommentsMode) {
  return mode !== 'disabled'
}

export function canSubmitArticleComments(mode: ArticleCommentsMode) {
  return mode === 'enabled'
}

export function toPrismaArticleCommentsMode(mode: ArticleCommentsMode): PrismaArticleCommentsMode {
  if (mode === 'readOnly') return PrismaArticleCommentsMode.READ_ONLY
  if (mode === 'disabled') return PrismaArticleCommentsMode.DISABLED
  return PrismaArticleCommentsMode.ENABLED
}

export function fromPrismaArticleCommentsMode(mode: PrismaArticleCommentsMode): ArticleCommentsMode {
  if (mode === PrismaArticleCommentsMode.READ_ONLY) return 'readOnly'
  if (mode === PrismaArticleCommentsMode.DISABLED) return 'disabled'
  return 'enabled'
}
