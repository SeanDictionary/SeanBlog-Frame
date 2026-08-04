import { ArticleStatus, Prisma } from '@prisma/client'

import { badRequest, conflict, notFound } from '@/lib/api/errors'
import {
  deleteArticleContent,
  deleteArticleRevisionMarkdown,
  getArticleContentPath,
  readArticleMarkdown,
  replaceArticleMarkdown,
  writeArticleMarkdown,
  writeArticleRevisionMarkdown,
} from '@/lib/content/article-content'
import { toPrismaArticleCommentsMode } from '@/lib/comment-settings'
import { createExcerpt, markdownToHtml } from '@/lib/content/markdown'
import { resolveSlug } from '@/lib/content/slug'
import { getPublicArticleWhere } from '@/lib/services/article-visibility'
import { getPrisma } from '@/lib/prisma'
import { parseSearchTerms, textIncludesAllSearchTerms } from '@/lib/search'
import {
  adminArticleDetailSelect,
  adminArticleSearchSelect,
  adminArticleSummarySelect,
  pageMeta,
  paginate,
  publicArticleDetailSelect,
  publicArticleSearchSelect,
  publicArticleSummarySelect,
  serializeArticleTags,
} from '@/lib/services/shared'
import type { ArticleInput, ArticleUpdateInput, PublicArticleSort } from '@/lib/validations/cms'

type PrismaExecutor = ReturnType<typeof getPrisma> | Prisma.TransactionClient
type ArticleContentSource = {
  contentPath: string | null
  legacyContentMarkdown: string | null
}

type ArticleWithTags<T> = T & {
  tags: Array<{ tag: { id: string; name: string; slug: string } }>
}

type PublicArticleSummaryRecord = Prisma.ArticleGetPayload<{ select: typeof publicArticleSummarySelect }>
type PublicArticleListItem = Omit<PublicArticleSummaryRecord, keyof ArticleContentSource | 'tags'> & {
  tags: Array<{ id: string; name: string; slug: string }>
}
type PaginatedPublicArticles = {
  items: PublicArticleListItem[]
  meta: ReturnType<typeof pageMeta>
}

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

  if (input.contentMarkdown !== undefined && (input.excerpt === undefined || input.excerpt === null)) {
    data.excerpt = createExcerpt(input.contentMarkdown, 200)
  }

  if (input.excerpt !== undefined && input.excerpt !== null) {
    data.excerpt = input.excerpt
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

  if (input.commentsMode !== undefined) {
    data.commentsMode = toPrismaArticleCommentsMode(input.commentsMode)
  }

  if (input.publishedAt !== undefined && input.status === undefined) {
    data.publishedAt = input.publishedAt
  }

  if (input.expiresAt !== undefined) {
    data.expiresAt = input.expiresAt
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

async function readMarkdownFromStorage(article: ArticleContentSource) {
  if (article.contentPath) {
    try {
      return await readArticleMarkdown(article.contentPath)
    } catch (error) {
      if (article.legacyContentMarkdown === null) {
        throw error
      }
    }
  }

  if (article.legacyContentMarkdown !== null) {
    return article.legacyContentMarkdown
  }

  throw badRequest('Article content is unavailable.')
}

function withoutContentSource<
  T extends ArticleContentSource & { tags: Array<{ tag: { id: string; name: string; slug: string } }> }
>(article: T): Omit<T, keyof ArticleContentSource | 'tags'> & { tags: Array<{ id: string; name: string; slug: string }> } {
  const { contentPath: _contentPath, legacyContentMarkdown: _legacyContentMarkdown, tags, ...rest } = article

  return {
    ...rest,
    tags: tags.map((item) => item.tag),
  }
}

async function withPublicArticleListExcerpt(article: PublicArticleSummaryRecord): Promise<PublicArticleListItem> {
  const serialized = withoutContentSource(article)

  if (serialized.excerpt) {
    return serialized
  }

  return {
    ...serialized,
    excerpt: createExcerpt(await readMarkdownFromStorage(article), 200),
  }
}

async function getPublicArticleRecord(slug: string) {
  return getPrisma().article.findFirst({
    where: {
      slug,
      ...getPublicArticleWhere(),
    },
    select: publicArticleDetailSelect,
  })
}

async function getAdminArticleRecord(id: string) {
  return getPrisma().article.findUnique({
    where: { id },
    select: adminArticleDetailSelect,
  })
}

async function withPublicArticleContent(article: NonNullable<Awaited<ReturnType<typeof getPublicArticleRecord>>>) {
  const markdown = await readMarkdownFromStorage(article)

  return {
    ...withoutContentSource(article),
    contentHtml: await markdownToHtml(markdown),
  }
}

async function withAdminArticleContent(article: NonNullable<Awaited<ReturnType<typeof getAdminArticleRecord>>>) {
  const markdown = await readMarkdownFromStorage(article)

  return {
    ...withoutContentSource(article),
    contentMarkdown: markdown,
    contentHtml: await markdownToHtml(markdown),
  }
}

async function createRevision(articleId: string, title: string, markdown: string, changeNote?: string | null) {
  const prisma = getPrisma()
  const latest = await prisma.articleRevision.findFirst({
    where: { articleId },
    orderBy: { version: 'desc' },
    select: { version: true },
  })
  const revision = await prisma.articleRevision.create({
    data: {
      articleId,
      title,
      contentPath: null,
      version: (latest?.version ?? 0) + 1,
      changeNote,
    },
  })

  let revisionContentPath: string | null = null

  try {
    revisionContentPath = await writeArticleRevisionMarkdown(articleId, revision.id, markdown)

    return await prisma.articleRevision.update({
      where: { id: revision.id },
      data: { contentPath: revisionContentPath },
    })
  } catch (error) {
    if (revisionContentPath) {
      await deleteArticleRevisionMarkdown(revisionContentPath).catch(() => undefined)
    }

    await prisma.articleRevision.delete({ where: { id: revision.id } }).catch(() => undefined)
    throw error
  }
}

async function deleteRevisionContent(revision: { id: string; contentPath: string | null }) {
  if (revision.contentPath) {
    await deleteArticleRevisionMarkdown(revision.contentPath).catch(() => undefined)
  }

  await getPrisma().articleRevision.delete({ where: { id: revision.id } }).catch(() => undefined)
}

async function syncArticleTags(articleId: string, tagIds: string[], client: PrismaExecutor = getPrisma()) {
  const uniqueTagIds = [...new Set(tagIds)]

  const existing = await client.articleTag.findMany({
    where: { articleId },
    select: { tagId: true },
  })
  const existingTagIds = new Set(existing.map((row) => row.tagId))
  const desiredTagIds = new Set(uniqueTagIds)

  const toRemove = [...existingTagIds].filter((tagId) => !desiredTagIds.has(tagId))
  const toAdd = uniqueTagIds.filter((tagId) => !existingTagIds.has(tagId))

  if (toRemove.length) {
    await client.articleTag.deleteMany({
      where: { articleId, tagId: { in: [...toRemove] } },
    })
  }

  if (toAdd.length) {
    await client.articleTag.createMany({
      data: toAdd.map((tagId) => ({ articleId, tagId })),
    })
  }
}

const SEARCH_CANDIDATE_LIMIT = 200

function getPublicArticleOrderBy(sort: Exclude<PublicArticleSort, 'commentCount'>): Prisma.ArticleOrderByWithRelationInput[] {
  if (sort === 'updatedAt') {
    return [{ updatedAt: 'desc' }, { publishedAt: 'desc' }]
  }

  if (sort === 'viewCount') {
    return [{ viewCount: 'desc' }, { publishedAt: 'desc' }]
  }

  return [{ isPinned: 'desc' }, { publishedAt: 'desc' }]
}

async function articleMatchesQuery(
  article: ArticleContentSource & { title: string; excerpt: string | null },
  searchTerms: string[],
) {
  if (textIncludesAllSearchTerms(article.title, searchTerms) || (article.excerpt && textIncludesAllSearchTerms(article.excerpt, searchTerms))) {
    return true
  }

  return textIncludesAllSearchTerms(await readMarkdownFromStorage(article), searchTerms)
}

export async function listPublicArticles(input: { page: number; pageSize: number; category?: string; tag?: string; sort?: PublicArticleSort }): Promise<PaginatedPublicArticles> {
  const prisma = getPrisma()
  const sort = input.sort ?? 'publishedAt'
  const where: Prisma.ArticleWhereInput = {
    ...getPublicArticleWhere(),
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

  if (sort === 'commentCount') {
    const [allItems, total] = await Promise.all([
      prisma.article.findMany({
        where,
        select: publicArticleSummarySelect,
      }),
      prisma.article.count({ where }),
    ])
    const sortedItems = [...allItems].sort((left, right) => {
      const commentDifference = right._count.comments - left._count.comments

      if (commentDifference !== 0) {
        return commentDifference
      }

      return (right.publishedAt?.getTime() ?? 0) - (left.publishedAt?.getTime() ?? 0)
    })
    const start = (input.page - 1) * input.pageSize
    const serializedItems = await Promise.all(sortedItems.slice(start, start + input.pageSize).map(withPublicArticleListExcerpt))

    return {
      items: serializedItems,
      meta: pageMeta(total, input.page, input.pageSize),
    }
  }

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      ...paginate(input.page, input.pageSize),
      orderBy: getPublicArticleOrderBy(sort),
      select: publicArticleSummarySelect,
    }),
    prisma.article.count({ where }),
  ])

  const serializedItems = await Promise.all(items.map(withPublicArticleListExcerpt))

  return {
    items: serializedItems,
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
  }

  if (!input.q) {
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

  const searchTerms = parseSearchTerms(input.q)
  const candidates = await prisma.article.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: SEARCH_CANDIDATE_LIMIT,
    select: adminArticleSearchSelect,
  })
  const matching = (
    await Promise.all(
      candidates.map(async (article) => ((await articleMatchesQuery(article, searchTerms)) ? article : null)),
    )
  ).filter((article): article is NonNullable<typeof article> => article !== null)
  const start = (input.page - 1) * input.pageSize

  return {
    items: matching.slice(start, start + input.pageSize).map(withoutContentSource),
    meta: pageMeta(matching.length, input.page, input.pageSize),
  }
}

export async function getPublicArticleNavigation(slug: string) {
  const articles = await getPrisma().article.findMany({
    where: getPublicArticleWhere(),
    orderBy: [{ publishedAt: 'desc' }, { title: 'asc' }],
    select: {
      title: true,
      slug: true,
    },
  })
  const currentIndex = articles.findIndex((article) => article.slug === slug)

  if (currentIndex === -1) {
    throw notFound('Article not found.')
  }

  return {
    previous: articles[currentIndex - 1] ?? null,
    next: articles[currentIndex + 1] ?? null,
  }
}

export async function getPublicArticleBySlug(slug: string) {
  const article = await getPublicArticleRecord(slug)

  if (!article) {
    throw notFound('Article not found.')
  }

  const detail = await withPublicArticleContent(article)

  try {
    await getPrisma().article.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    })
  } catch (error) {
    console.error(`Unable to increment the view count for article ${article.id}.`, error)
  }

  return detail
}

export async function getAdminArticleById(id: string) {
  const article = await getAdminArticleRecord(id)

  if (!article) {
    throw notFound('Article not found.')
  }

  return withAdminArticleContent(article)
}

export async function getAdminArticleRevision(articleId: string, revisionId: string) {
  const revision = await getPrisma().articleRevision.findFirst({
    where: {
      id: revisionId,
      articleId,
    },
    select: {
      id: true,
      articleId: true,
      title: true,
      version: true,
      changeNote: true,
      contentPath: true,
      legacyContentMarkdown: true,
      createdAt: true,
    },
  })

  if (!revision) {
    throw notFound('Article revision not found.')
  }

  const contentMarkdown = await readMarkdownFromStorage(revision)

  return {
    id: revision.id,
    articleId: revision.articleId,
    title: revision.title,
    version: revision.version,
    changeNote: revision.changeNote,
    createdAt: revision.createdAt,
    contentMarkdown,
    contentHtml: await markdownToHtml(contentMarkdown),
  }
}

export async function createArticle(input: ArticleInput) {
  const prisma = getPrisma()
  const data = buildArticleData(input, { generateSlugFromTitle: true })
  let articleId: string | null = null
  let contentPath: string | null = null

  try {
    const article = await prisma.$transaction(async (tx) => {
      const created = await tx.article.create({
        data: data as Prisma.ArticleUncheckedCreateInput,
      })

      await syncArticleTags(created.id, input.tagIds, tx)

      return created
    })
    articleId = article.id
    contentPath = await writeArticleMarkdown(article.id, input.contentMarkdown)

    await prisma.article.update({
      where: { id: article.id },
      data: { contentPath },
    })
    await createRevision(article.id, article.title, input.contentMarkdown, input.changeNote ?? 'Initial version')

    return getAdminArticleById(article.id)
  } catch (error) {
    if (articleId) {
      await prisma.article.delete({ where: { id: articleId } }).catch(() => undefined)
    }

    if (contentPath) {
      await deleteArticleContent(contentPath).catch(() => undefined)
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('Article slug already exists.')
    }

    throw error
  }
}

export async function updateArticle(id: string, input: ArticleUpdateInput) {
  const prisma = getPrisma()
  const existing = await prisma.article.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      contentPath: true,
      legacyContentMarkdown: true,
    },
  })

  if (!existing) {
    throw notFound('Article not found.')
  }

  const data = buildArticleData(input)
  const contentChanged = input.contentMarkdown !== undefined
  const previousMarkdown = contentChanged ? await readMarkdownFromStorage(existing) : ''
  const markdown = input.contentMarkdown ?? previousMarkdown
  let contentPath: string | null = null
  let revision: { id: string; contentPath: string | null } | null = null

  try {
    if (contentChanged) {
      contentPath = await replaceArticleMarkdown(existing.contentPath ?? getArticleContentPath(id), markdown)
      revision = await createRevision(id, input.title ?? existing.title, markdown, input.changeNote)
    }

    await prisma.$transaction(async (tx) => {
      await tx.article.update({
        where: { id },
        data: {
          ...data,
          ...(contentPath ? { contentPath } : {}),
        },
      })

      if (input.tagIds !== undefined) {
        await syncArticleTags(id, input.tagIds, tx)
      }
    })

    return getAdminArticleById(id)
  } catch (error) {
    if (revision) {
      await deleteRevisionContent(revision)
    }

    if (contentChanged && contentPath) {
      if (existing.contentPath) {
        await replaceArticleMarkdown(existing.contentPath, previousMarkdown).catch(() => undefined)
      } else {
        await deleteArticleContent(contentPath).catch(() => undefined)
      }
    }

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
  const prisma = getPrisma()

  try {
    const article = await prisma.article.delete({
      where: { id },
      select: { contentPath: true },
    })

    if (article.contentPath) {
      await deleteArticleContent(article.contentPath).catch((error) => {
        console.error(`Unable to remove content files for article ${id}.`, error)
      })
    }
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
  const searchTerms = parseSearchTerms(input.q)
  const candidates = await getPrisma().article.findMany({
    where: getPublicArticleWhere(),
    orderBy: { publishedAt: 'desc' },
    take: SEARCH_CANDIDATE_LIMIT,
    select: publicArticleSearchSelect,
  })
  const matching = (
    await Promise.all(
      candidates.map(async (article) => ((await articleMatchesQuery(article, searchTerms)) ? article : null)),
    )
  ).filter((article): article is NonNullable<typeof article> => article !== null)
  const start = (input.page - 1) * input.pageSize

  return {
    items: matching.slice(start, start + input.pageSize).map(withoutContentSource),
    meta: pageMeta(matching.length, input.page, input.pageSize),
  }
}
