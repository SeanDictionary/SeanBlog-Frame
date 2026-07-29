import type { Prisma } from '@prisma/client'

export const categorySummarySelect = {
  id: true,
  name: true,
  slug: true,
} satisfies Prisma.CategorySelect

export type TagSummary = {
  id: string
  name: string
  slug: string
}

export const tagSummarySelect = {
  id: true,
  name: true,
  slug: true,
} satisfies Prisma.TagSelect

export const publicArticleSummarySelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  isPinned: true,
  publishedAt: true,
  category: {
    select: categorySummarySelect,
  },
  tags: {
    include: {
      tag: {
        select: tagSummarySelect,
      },
    },
  },
} satisfies Prisma.ArticleSelect

export const publicArticleSearchSelect = {
  ...publicArticleSummarySelect,
  contentPath: true,
  legacyContentMarkdown: true,
} satisfies Prisma.ArticleSelect

const publicCommentBaseSelect = {
  id: true,
  content: true,
  guestName: true,
  createdAt: true,
  parentId: true,
} satisfies Prisma.CommentSelect

export const publicArticleDetailSelect = {
  id: true,
  title: true,
  slug: true,
  contentPath: true,
  legacyContentMarkdown: true,
  excerpt: true,
  coverImage: true,
  metaTitle: true,
  metaDescription: true,
  metaKeywords: true,
  publishedAt: true,
  viewCount: true,
  category: {
    select: categorySummarySelect,
  },
  tags: {
    include: {
      tag: {
        select: tagSummarySelect,
      },
    },
  },
  comments: {
    where: {
      status: 'APPROVED',
      parentId: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      ...publicCommentBaseSelect,
      replies: {
        where: {
          status: 'APPROVED',
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: publicCommentBaseSelect,
      },
    },
  },
} satisfies Prisma.ArticleSelect

export const adminArticleSummarySelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  status: true,
  isPinned: true,
  publishedAt: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: categorySummarySelect,
  },
  tags: {
    include: {
      tag: {
        select: tagSummarySelect,
      },
    },
  },
} satisfies Prisma.ArticleSelect

export const adminArticleSearchSelect = {
  ...adminArticleSummarySelect,
  contentPath: true,
  legacyContentMarkdown: true,
} satisfies Prisma.ArticleSelect

const articleRevisionSummarySelect = {
  id: true,
  version: true,
  title: true,
  changeNote: true,
  createdAt: true,
} satisfies Prisma.ArticleRevisionSelect

export const adminArticleDetailSelect = {
  id: true,
  title: true,
  slug: true,
  contentPath: true,
  legacyContentMarkdown: true,
  excerpt: true,
  coverImage: true,
  status: true,
  metaTitle: true,
  metaDescription: true,
  metaKeywords: true,
  isPinned: true,
  publishedAt: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  categoryId: true,
  category: {
    select: categorySummarySelect,
  },
  tags: {
    include: {
      tag: {
        select: tagSummarySelect,
      },
    },
  },
  revisions: {
    orderBy: {
      version: 'desc',
    },
    select: articleRevisionSummarySelect,
  },
} satisfies Prisma.ArticleSelect

export function serializeArticleTags<T extends { tags?: Array<{ tag: TagSummary }> }>(article: T) {
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
