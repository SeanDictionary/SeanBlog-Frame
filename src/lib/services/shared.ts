import type { Prisma } from '@prisma/client'

export const articleInclude = {
  category: true,
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.ArticleInclude

export function serializeArticle<T extends { tags?: Array<{ tag: unknown }> }>(article: T) {
  if (!article.tags) {
    return article
  }

  const { tags, ...rest } = article
  return {
    ...rest,
    tags: tags.map((item) => item.tag),
  }
}

export function paginate(page: number, pageSize: number) {
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  }
}

export function pageMeta(total: number, page: number, pageSize: number) {
  return {
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  }
}
