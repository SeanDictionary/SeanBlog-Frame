import { ArticleStatus, Prisma } from '@prisma/client'

import { conflict, notFound } from '@/lib/api/errors'
import { createExcerpt, markdownToHtml } from '@/lib/content/markdown'
import { resolveSlug } from '@/lib/content/slug'
import { getPrisma } from '@/lib/prisma'
import {
  adminArticleDetailSelect,
  adminArticleSummarySelect,
  pageMeta,
  paginate,
  publicArticleDetailSelect,
  publicArticleSummarySelect,
  serializeArticleTags,
} from '@/lib/services/shared'
import type { ArticleInput, ArticleUpdateInput } from '@/lib/validations/cms'

const publicArticleWhere = {
  status: ArticleStatus.PUBLISHED,
  publishedAt: {
    not: null,
  },
} satisfies Prisma.ArticleWhereInput

type PrismaExecutor = ReturnType<typeof getPrisma> | Prisma.TransactionClient

function buildArticleData(input: ArticleInput | ArticleUpdateInput, options: { generateSlugFromTitle?: boolean } = {}) {
  const data: Prisma.ArticleUncheckedUpdateInput = {}

  if (input.title !== undefined) {
    data.title = input.title
  }

  if (input.slug !== undefined) {
    data.slug = resolveSlug({ slug: input.slug })
  } else if (options.generateSlugFromTitle && input.title !== undefined) {
    data.slug = resolveSlug({ title: input.title })
  }

  if (input.contentMarkdown !== undefined) {
    data.contentMarkdown = input.contentMarkdown
    data.contentHtml = input.contentHtml ?? markdownToHtml(input.contentMarkdown)

    if (input.excerpt === undefined) {
      data.excerpt = createExcerpt(input.contentMarkdown)
    }
  }

  if (input.excerpt !== undefined) {
    data.excerpt = input.excerpt
  }

  if (input.contentHtml !== undefined && input.contentMarkdown === undefined && input.contentHtml !== null) {
    data.contentHtml = input.contentHtml
  }

  if (input.coverImage !== undefined) {
    data.coverImage = input.coverImage
  }

  if (input.status !== undefined) {
    data.status = input.status

    if (input.status === ArticleStatus.PUBLISHED) {
      data.publishedAt = input.publishedAt ?? new Date()
    }

    if (input.status !== ArticleStatus.PUBLISHED) {
      data.publishedAt = input.publishedAt ?? null
    }
  }

  if (input.publishedAt !== undefined && input.status === undefined) {
    data.publishedAt = input.publishedAt
  }

  if (input.metaTitle !== undefined) {
    data.metaTitle = input.metaTitle
  }

  if (input.metaDescription !== undefined) {
    data.metaDescription = input.metaDescription
  }

  if (input.metaKeywords !== undefined) {
    data.metaKeywords = input.metaKeywords
  }

  if (input.isPinned !== undefined) {
    data.isPinned = input.isPinned
  }

  if (input.categoryId !== undefined) {
    data.categoryId = input.categoryId
  }

  return data
}

async function createRevision(articleId: string, changeNote?: string | null, client: PrismaExecutor = getPrisma()) {
  const article = await client.article.findUnique({ where: { id: articleId } })

  if (!article) {
    throw notFound('Article not found.')
  }

  const latest = await client.articleRevision.findFirst({
    where: { articleId },
    orderBy: { version: 'desc' },
    select: { version: true },
  })

  return client.articleRevision.create({
    data: {
      articleId,
      title: article.title,
      contentMarkdown: article.contentMarkdown,
      contentHtml: article.contentHtml,
      version: (latest?.version ?? 0) + 1,
      changeNote,
    },
  })
}

async function syncArticleTags(articleId: string, tagIds: string[], client: PrismaExecutor = getPrisma()) {
  await client.articleTag.deleteMany({ where: { articleId } })

  if (!tagIds.length) {
    return
  }

  await client.articleTag.createMany({
    data: [...new Set(tagIds)].map((tagId) => ({ articleId, tagId })),
  })
}

export async function listPublicArticles(input: { page: number; pageSize: number; category?: string; tag?: string }) {
  const prisma = getPrisma()
  const where: Prisma.ArticleWhereInput = {
    ...publicArticleWhere,
    ...(input.category
      ? {
          category: {
            slug: input.category,
          },
        }
      : {}),
    ...(input.tag
      ? {
          tags: {
            some: {
              tag: {
                slug: input.tag,
              },
            },
          },
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      ...paginate(input.page, input.pageSize),
      orderBy: [
        { isPinned: 'desc' },
        { publishedAt: 'desc' },
      ],
      select: publicArticleSummarySelect,
    }),
    prisma.article.count({ where }),
  ])

  return {
    items: items.map(serializeArticleTags),
    meta: pageMeta(total, input.page, input.pageSize),
  }
}

export async function listAdminArticles(input: {
  page: number
  pageSize: number
  status?: ArticleStatus
  category?: string
  tag?: string
  q?: string
}) {
  const prisma = getPrisma()
  const where: Prisma.ArticleWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.category ? { category: { slug: input.category } } : {}),
    ...(input.tag ? { tags: { some: { tag: { slug: input.tag } } } } : {}),
    ...(input.q
      ? {
          OR: [
            { title: { contains: input.q, mode: 'insensitive' } },
            { excerpt: { contains: input.q, mode: 'insensitive' } },
            { contentMarkdown: { contains: input.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      ...paginate(input.page, input.pageSize),
      orderBy: { updatedAt: 'desc' },
      select: adminArticleSummarySelect,
    }),
    prisma.article.count({ where }),
  ])

  return {
    items: items.map(serializeArticleTags),
    meta: pageMeta(total, input.page, input.pageSize),
  }
}

export async function getPublicArticleBySlug(slug: string) {
  const article = await getPrisma().article.findFirst({
    where: {
      slug,
      ...publicArticleWhere,
    },
    select: publicArticleDetailSelect,
  })

  if (!article) {
    throw notFound('Article not found.')
  }

  return serializeArticleTags(article)
}

export async function getAdminArticleById(id: string) {
  const article = await getPrisma().article.findUnique({
    where: { id },
    select: adminArticleDetailSelect,
  })

  if (!article) {
    throw notFound('Article not found.')
  }

  return serializeArticleTags(article)
}

export async function createArticle(input: ArticleInput) {
  const prisma = getPrisma()
  const data = buildArticleData(input, { generateSlugFromTitle: true })

  try {
    const articleId = await prisma.$transaction(async (tx) => {
      const article = await tx.article.create({
        data: data as Prisma.ArticleUncheckedCreateInput,
      })

      await syncArticleTags(article.id, input.tagIds, tx)
      await createRevision(article.id, input.changeNote ?? 'Initial version', tx)

      return article.id
    })

    return getAdminArticleById(articleId)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('Article slug already exists.')
    }

    throw error
  }
}

export async function updateArticle(id: string, input: ArticleUpdateInput) {
  const prisma = getPrisma()
  const data = buildArticleData(input)

  try {
    await prisma.$transaction(async (tx) => {
      await tx.article.update({
        where: { id },
        data,
      })

      if (input.tagIds) {
        await syncArticleTags(id, input.tagIds, tx)
      }

      await createRevision(id, input.changeNote, tx)
    })

    return getAdminArticleById(id)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw notFound('Article not found.')
      }

      if (error.code === 'P2002') {
        throw conflict('Article slug already exists.')
      }
    }

    throw error
  }
}

export async function deleteArticle(id: string) {
  try {
    await getPrisma().article.delete({ where: { id } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw notFound('Article not found.')
    }

    throw error
  }
}

export async function publishArticle(id: string) {
  return updateArticle(id, {
    status: ArticleStatus.PUBLISHED,
    publishedAt: new Date(),
    changeNote: 'Published article',
  })
}

export async function archiveArticle(id: string) {
  return updateArticle(id, {
    status: ArticleStatus.ARCHIVED,
    changeNote: 'Archived article',
  })
}

export async function searchArticles(input: { q: string; page: number; pageSize: number }) {
  const prisma = getPrisma()
  const where: Prisma.ArticleWhereInput = {
    ...publicArticleWhere,
    OR: [
      { title: { contains: input.q, mode: 'insensitive' } },
      { excerpt: { contains: input.q, mode: 'insensitive' } },
      { contentMarkdown: { contains: input.q, mode: 'insensitive' } },
    ],
  }

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      ...paginate(input.page, input.pageSize),
      orderBy: { publishedAt: 'desc' },
      select: publicArticleSummarySelect,
    }),
    prisma.article.count({ where }),
  ])

  return {
    items: items.map(serializeArticleTags),
    meta: pageMeta(total, input.page, input.pageSize),
  }
}
