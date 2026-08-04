import { ArticleStatus, type Prisma } from '@prisma/client'

export function getPublicArticleWhere(now = new Date()) {
  return {
    status: ArticleStatus.PUBLISHED,
    publishedAt: {
      not: null,
      lte: now,
    },
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ],
  } satisfies Prisma.ArticleWhereInput
}
