import { Prisma } from '@prisma/client'

import { badRequest, conflict, forbidden, notFound } from '@/lib/api/errors'
import { createSlugFromTitle } from '@/lib/content/pinyin-slug'
import { isValidSlug, resolveSlug, slugify } from '@/lib/content/slug'
import { getPrisma } from '@/lib/prisma'
import { getPublicArticleWhere } from '@/lib/services/article-visibility'
import { pageMeta, paginate } from '@/lib/services/shared'
import type { CategoryInput, CategoryUpdateInput, TaxonomyImportInput } from '@/lib/validations/cms'

export const DEFAULT_CATEGORY_NAME = '未分类'
export const DEFAULT_CATEGORY_SLUG = 'uncategorized'

type PrismaExecutor = ReturnType<typeof getPrisma> | Prisma.TransactionClient

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

function isDefaultCategory(category: { slug: string }) {
  return category.slug === DEFAULT_CATEGORY_SLUG
}

function assertDefaultCategoryMutable(category: { slug: string }, input: CategoryUpdateInput) {
  if (!isDefaultCategory(category)) return

  const nextName = input.name?.trim()
  const nextSlug = input.slug === undefined ? undefined : resolveSlug({ slug: input.slug })

  if ((nextName && nextName !== DEFAULT_CATEGORY_NAME) || (nextSlug && nextSlug !== DEFAULT_CATEGORY_SLUG)) {
    throw forbidden('Default category name and slug cannot be changed.')
  }
}

function assertDefaultCategoryDeletable(category: { slug: string }) {
  if (isDefaultCategory(category)) {
    throw forbidden('Default category cannot be deleted.')
  }
}

export async function ensureDefaultCategory(client: PrismaExecutor = getPrisma()) {
  const existing = await client.category.findFirst({
    where: {
      OR: [
        { slug: DEFAULT_CATEGORY_SLUG },
        { name: DEFAULT_CATEGORY_NAME },
      ],
    },
    include: includeArticleCount(),
  })

  if (!existing) {
    return client.category.create({
      data: {
        name: DEFAULT_CATEGORY_NAME,
        slug: DEFAULT_CATEGORY_SLUG,
      },
      include: includeArticleCount(),
    })
  }

  if (existing.name === DEFAULT_CATEGORY_NAME && existing.slug === DEFAULT_CATEGORY_SLUG) {
    return existing
  }

  return client.category.update({
    where: { id: existing.id },
    data: {
      name: DEFAULT_CATEGORY_NAME,
      slug: DEFAULT_CATEGORY_SLUG,
    },
    include: includeArticleCount(),
  })
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
  await ensureDefaultCategory()

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
  const prisma = getPrisma()
  const category = await prisma.category.findUnique({
    where: { id },
    select: { slug: true },
  })

  if (!category) {
    throw notFound('Category not found.')
  }

  assertDefaultCategoryMutable(category, input)

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
    return await prisma.category.update({
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
  const prisma = getPrisma()
  const category = await prisma.category.findUnique({
    where: { id },
    select: { slug: true },
  })

  if (!category) {
    throw notFound('Category not found.')
  }

  assertDefaultCategoryDeletable(category)

  await prisma.category.delete({ where: { id } })
}

export async function deleteCategories(ids: string[]) {
  const prisma = getPrisma()
  const categories = await prisma.category.findMany({
    where: { id: { in: ids } },
    select: { slug: true },
  })

  categories.forEach(assertDefaultCategoryDeletable)

  const result = await prisma.category.deleteMany({ where: { id: { in: ids } } })
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
    await ensureDefaultCategory(client)

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
