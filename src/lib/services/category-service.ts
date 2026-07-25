import { Prisma } from '@prisma/client'

import { conflict, notFound } from '@/lib/api/errors'
import { resolveSlug } from '@/lib/content/slug'
import { getPrisma } from '@/lib/prisma'
import type { CategoryInput, CategoryUpdateInput } from '@/lib/validations/cms'

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

  if (input.slug !== undefined || input.name !== undefined) {
    data.slug = resolveSlug({ slug: input.slug, name: input.name })
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
