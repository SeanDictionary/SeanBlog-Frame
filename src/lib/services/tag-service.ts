import { Prisma } from '@prisma/client'

import { badRequest, conflict, notFound } from '@/lib/api/errors'
import { createSlugFromTitle } from '@/lib/content/pinyin-slug'
import { isValidSlug, resolveSlug, slugify } from '@/lib/content/slug'
import { getPrisma } from '@/lib/prisma'
import { getPublicArticleWhere } from '@/lib/services/article-visibility'
import { pageMeta, paginate } from '@/lib/services/shared'
import type { TagInput, TagUpdateInput, TaxonomyImportInput } from '@/lib/validations/cms'

function getPublicArticleTagWhere() {
  return {
    article: getPublicArticleWhere(),
  } satisfies Prisma.ArticleTagWhereInput
}

function normalizeTagSlug(input: Pick<TagInput, 'name' | 'slug'>) {
  return input.slug ? resolveSlug({ slug: input.slug }) : createSlugFromTitle(input.name)
}

function includeArticleCount() {
  return {
    _count: {
      select: {
        articles: true,
      },
    },
  } satisfies Prisma.TagInclude
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
    include: includeArticleCount(),
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
    include: includeArticleCount(),
  })

  if (!tag) {
    throw notFound('Tag not found.')
  }

  return tag
}

export async function checkTagSlugAvailability(input: { slug?: string; name?: string; excludeId?: string }) {
  const slug = input.slug?.trim() ? slugify(input.slug) : createSlugFromTitle(input.name ?? '')

  if (!slug || !isValidSlug(slug)) {
    return { slug, available: false, message: 'Slug 只能包含小写字母、数字和短横线。' }
  }

  const existing = await getPrisma().tag.findFirst({
    where: {
      slug,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: { id: true },
  })

  return {
    slug,
    available: existing === null,
    message: existing ? '该 Slug 已被其他标签使用。' : null,
  }
}

export async function createTag(input: TagInput) {
  const slug = normalizeTagSlug(input)

  try {
    return await getPrisma().tag.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
      },
      include: includeArticleCount(),
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

  if (input.description !== undefined) {
    data.description = input.description
  }

  try {
    return await getPrisma().tag.update({
      where: { id },
      data,
      include: includeArticleCount(),
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

export async function deleteTags(ids: string[]) {
  const result = await getPrisma().tag.deleteMany({ where: { id: { in: ids } } })
  return { deleted: result.count }
}

export async function importTags(input: TaxonomyImportInput) {
  if (input.type && input.type !== 'tags') {
    throw badRequest('Import file type does not match tags.', 'TAXONOMY_IMPORT_TYPE_MISMATCH')
  }

  const seenNames = new Set<string>()
  const seenSlugs = new Set<string>()
  const normalized = input.items.map((item) => {
    const slug = normalizeTagSlug(item)
    const nameKey = item.name.toLocaleLowerCase()

    if (seenNames.has(nameKey)) {
      throw badRequest(`Duplicate tag name in import file: ${item.name}`, 'DUPLICATE_TAXONOMY_NAME')
    }
    if (seenSlugs.has(slug)) {
      throw badRequest(`Duplicate tag slug in import file: ${slug}`, 'DUPLICATE_TAXONOMY_SLUG')
    }

    seenNames.add(nameKey)
    seenSlugs.add(slug)

    return {
      name: item.name,
      slug,
      description: item.description,
    }
  })

  return getPrisma().$transaction(async (client) => {
    const existing = await client.tag.findMany({
      where: {
        OR: [
          { name: { in: normalized.map((item) => item.name) } },
          { slug: { in: normalized.map((item) => item.slug) } },
        ],
      },
      select: { name: true, slug: true },
    })

    if (existing.length) {
      throw conflict(`Tag already exists: ${existing.map((item) => item.name || item.slug).join(', ')}`)
    }

    const created = []
    for (const item of normalized) {
      created.push(await client.tag.create({ data: item, include: includeArticleCount() }))
    }

    return created
  })
}
