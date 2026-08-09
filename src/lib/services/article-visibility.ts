import { ArticleStatus, type Prisma } from '@prisma/client'

export function getPublicArticleWhere(now = new Date()) {
  return {
    status: ArticleStatus.PUBLISHED,
    publishedAt: {
      not: null,
      lte: now,
    },
  } satisfies Prisma.ArticleWhereInput
}
