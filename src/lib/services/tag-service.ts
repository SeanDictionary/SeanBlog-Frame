import { Prisma } from '@prisma/client'

import { conflict, notFound } from '@/lib/api/errors'
import { createSlugFromTitle } from '@/lib/content/pinyin-slug'
import { resolveSlug } from '@/lib/content/slug'
import { getPrisma } from '@/lib/prisma'
import { getPublicArticleWhere } from '@/lib/services/article-visibility'
import { pageMeta, paginate } from '@/lib/services/shared'
import type { TagInput, TagUpdateInput } from '@/lib/validations/cms'

function getPublicArticleTagWhere() {
  return {
    article: getPublicArticleWhere(),
  } satisfies Prisma.ArticleTagWhereInput
}

export async function listPublicTags(input: { page: number; pageSize: number }) {
  const prisma = getPrisma()
  const publicArticleTagWhere = getPublicArticleTagWhere()
  const where: Prisma.TagWhereInput = {
    articles: {
      some: publicArticleTagWhere,
    },
  }

  const [items, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      ...paginate(input.page, input.pageSize),
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            articles: {
              where: publicArticleTagWhere,
            },
          },
        },
      },
    }),
    prisma.tag.count({ where }),
  ])

  return {
    items,
    meta: pageMeta(total, input.page, input.pageSize),
  }
}

export async function listTags() {
  return getPrisma().tag.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          articles: true,
        },
      },
    },
  })
}

export async function getPublicTagBySlug(slug: string) {
  const publicArticleTagWhere = getPublicArticleTagWhere()
  const tag = await getPrisma().tag.findFirst({
    where: {
      slug,
      articles: {
        some: publicArticleTagWhere,
      },
    },
    include: {
      _count: {
        select: {
          articles: {
            where: publicArticleTagWhere,
          },
        },
      },
    },
  })

  if (!tag) {
    throw notFound('Tag not found.')
  }

  return tag
}

export async function getTagBySlug(slug: string) {
  const tag = await getPrisma().tag.findUnique({
    where: { slug },
    include: {
      _count: {
        select: {
          articles: true,
        },
      },
    },
  })

  if (!tag) {
    throw notFound('Tag not found.')
  }

  return tag
}

export async function createTag(input: TagInput) {
  const slug = input.slug ? resolveSlug({ slug: input.slug }) : createSlugFromTitle(input.name)

  try {
    return await getPrisma().tag.create({
      data: {
        name: input.name,
        slug,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('Tag name or slug already exists.')
    }

    throw error
  }
}

export async function updateTag(id: string, input: TagUpdateInput) {
  const data: Prisma.TagUpdateInput = {}

  if (input.name !== undefined) {
    data.name = input.name
  }

  if (input.slug !== undefined) {
    data.slug = resolveSlug({ slug: input.slug })
  }

  try {
    return await getPrisma().tag.update({
      where: { id },
      data,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw notFound('Tag not found.')
      }

      if (error.code === 'P2002') {
        throw conflict('Tag name or slug already exists.')
      }
    }

    throw error
  }
}

export async function deleteTag(id: string) {
  try {
    await getPrisma().tag.delete({ where: { id } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw notFound('Tag not found.')
    }

    throw error
  }
}
