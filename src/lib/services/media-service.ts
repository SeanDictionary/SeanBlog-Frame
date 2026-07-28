import { Prisma } from '@prisma/client'

import { conflict, notFound } from '@/lib/api/errors'
import { getPrisma } from '@/lib/prisma'
import { pageMeta, paginate } from '@/lib/services/shared'
import type { MediaInput } from '@/lib/validations/cms'

export async function listMedia(input: { page: number; pageSize: number }) {
  const prisma = getPrisma()
  const where: Prisma.MediaWhereInput = {}

  const [items, total] = await Promise.all([
    prisma.media.findMany({
      where,
      ...paginate(input.page, input.pageSize),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.media.count({ where }),
  ])

  return {
    items,
    meta: pageMeta(total, input.page, input.pageSize),
  }
}

export async function createMedia(input: MediaInput) {
  try {
    return await getPrisma().media.create({
      data: input,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('Media key already exists.')
    }

    throw error
  }
}

export async function deleteMedia(id: string) {
  try {
    await getPrisma().media.delete({ where: { id } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw notFound('Media item not found.')
    }

    throw error
  }
}
