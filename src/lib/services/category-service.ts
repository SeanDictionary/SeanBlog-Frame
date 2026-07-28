import { ArticleStatus, Prisma } from '@prisma/client'

import { conflict, notFound } from '@/lib/api/errors'
import { resolveSlug } from '@/lib/content/slug'
import { getPrisma } from '@/lib/prisma'
import { pageMeta, paginate } from '@/lib/services/shared'
import type { CategoryInput, CategoryUpdateInput } from '@/lib/validations/cms'

const publicArticleWhere = {
  status: ArticleStatus.PUBLISHED,
  publishedAt: { not: null },
} satisfies Prisma.ArticleWhereInput

const publishedArticleCount = {
  where: publicArticleWhere,
}

export async function listPublicCategories(input: { page: number; pageSize: number }) {
  const prisma = getPrisma()
  const where: Prisma.CategoryWhereInput = {
    articles: {
      some: publicArticleWhere,
    },
  }

  const [items, total] = await Promise.all([
    prisma.category.findMany({
      where,
      ...paginate(input.page, input.pageSize),
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
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
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' },
    ],
    include: {
      _count: {
        select: {
          articles: true,
        },
      },
    },
  })
}

export async function getPublicCategoryBySlug(slug: string) {
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
    include: {
      _count: {
        select: {
          articles: true,
        },
      },
    },
  })

  if (!category) {
    throw notFound('Category not found.')
  }

  return category
}

export async function createCategory(input: CategoryInput) {
  const slug = resolveSlug({ slug: input.slug, name: input.name })

  try {
    return await getPrisma().category.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        sortOrder: input.sortOrder,
      },
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

  if (input.sortOrder !== undefined) {
    data.sortOrder = input.sortOrder
  }

  try {
    return await getPrisma().category.update({
      where: { id },
      data,
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
