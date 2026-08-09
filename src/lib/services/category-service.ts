import { Prisma } from '@prisma/client'

import { badRequest, conflict, notFound } from '@/lib/api/errors'
import { createSlugFromTitle } from '@/lib/content/pinyin-slug'
import { isValidSlug, resolveSlug, slugify } from '@/lib/content/slug'
import { getPrisma } from '@/lib/prisma'
import { getPublicArticleWhere } from '@/lib/services/article-visibility'
import { pageMeta, paginate } from '@/lib/services/shared'
import type { CategoryInput, CategoryUpdateInput, TaxonomyImportInput } from '@/lib/validations/cms'

function normalizeCategorySlug(input: Pick<CategoryInput, 'name' | 'slug'>) {
  return input.slug ? resolveSlug({ slug: input.slug }) : createSlugFromTitle(input.name)
}

function includeArticleCount() {
  return {
    _count: {
      select: {
        articles: true,
      },
    },
  } satisfies Prisma.CategoryInclude
}

export async function listPublicCategories(input: { page: number; pageSize: number }) {
  const prisma = getPrisma()
  const publicArticleWhere = getPublicArticleWhere()
  const publishedArticleCount = { where: publicArticleWhere }
  const where: Prisma.CategoryWhereInput = {
    articles: {
      some: publicArticleWhere,
    },
  }

  const [items, total] = await Promise.all([
    prisma.category.findMany({
      where,
      ...paginate(input.page, input.pageSize),
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            articles: publishedArticleCount,
          },
        },
      },
    }),
    prisma.category.count({ where }),
  ])

  return {
    items,
    meta: pageMeta(total, input.page, input.pageSize),
  }
}

export async function listCategories() {
  return getPrisma().category.findMany({
    orderBy: { name: 'asc' },
    include: includeArticleCount(),
  })
}

export async function getPublicCategoryBySlug(slug: string) {
  const publicArticleWhere = getPublicArticleWhere()
  const publishedArticleCount = { where: publicArticleWhere }
  const category = await getPrisma().category.findFirst({
    where: {
      slug,
      articles: {
        some: publicArticleWhere,
      },
    },
    include: {
      _count: {
        select: {
          articles: publishedArticleCount,
        },
      },
    },
  })

  if (!category) {
    throw notFound('Category not found.')
  }

  return category
}

export async function getCategoryBySlug(slug: string) {
  const category = await getPrisma().category.findUnique({
    where: { slug },
    include: includeArticleCount(),
  })

  if (!category) {
    throw notFound('Category not found.')
  }

  return category
}

export async function checkCategorySlugAvailability(input: { slug?: string; name?: string; excludeId?: string }) {
  const slug = input.slug?.trim() ? slugify(input.slug) : createSlugFromTitle(input.name ?? '')

  if (!slug || !isValidSlug(slug)) {
    return { slug, available: false, message: 'Slug 只能包含小写字母、数字和短横线。' }
  }

  const existing = await getPrisma().category.findFirst({
    where: {
      slug,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: { id: true },
  })

  return {
    slug,
    available: existing === null,
    message: existing ? '该 Slug 已被其他分类使用。' : null,
  }
}

export async function createCategory(input: CategoryInput) {
  const slug = normalizeCategorySlug(input)

  try {
    return await getPrisma().category.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
      },
      include: includeArticleCount(),
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('Category name or slug already exists.')
    }

    throw error
  }
}

export async function updateCategory(id: string, input: CategoryUpdateInput) {
  const data: Prisma.CategoryUpdateInput = {}

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
    return await getPrisma().category.update({
      where: { id },
      data,
      include: includeArticleCount(),
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw notFound('Category not found.')
      }

      if (error.code === 'P2002') {
        throw conflict('Category name or slug already exists.')
      }
    }

    throw error
  }
}

export async function deleteCategory(id: string) {
  try {
    await getPrisma().category.delete({ where: { id } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw notFound('Category not found.')
    }

    throw error
  }
}

export async function deleteCategories(ids: string[]) {
  const result = await getPrisma().category.deleteMany({ where: { id: { in: ids } } })
  return { deleted: result.count }
}

export async function importCategories(input: TaxonomyImportInput) {
  if (input.type && input.type !== 'categories') {
    throw badRequest('Import file type does not match categories.', 'TAXONOMY_IMPORT_TYPE_MISMATCH')
  }

  const seenNames = new Set<string>()
  const seenSlugs = new Set<string>()
  const normalized = input.items.map((item) => {
    const slug = normalizeCategorySlug(item)
    const nameKey = item.name.toLocaleLowerCase()

    if (seenNames.has(nameKey)) {
      throw badRequest(`Duplicate category name in import file: ${item.name}`, 'DUPLICATE_TAXONOMY_NAME')
    }
    if (seenSlugs.has(slug)) {
      throw badRequest(`Duplicate category slug in import file: ${slug}`, 'DUPLICATE_TAXONOMY_SLUG')
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
    const existing = await client.category.findMany({
      where: {
        OR: [
          { name: { in: normalized.map((item) => item.name) } },
          { slug: { in: normalized.map((item) => item.slug) } },
        ],
      },
      select: { name: true, slug: true },
    })

    if (existing.length) {
      throw conflict(`Category already exists: ${existing.map((item) => item.name || item.slug).join(', ')}`)
    }

    const created = []
    for (const item of normalized) {
      created.push(await client.category.create({ data: item, include: includeArticleCount() }))
    }

    return created
  })
}
