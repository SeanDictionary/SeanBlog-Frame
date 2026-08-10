import { rm } from 'node:fs/promises'
import path from 'node:path'

import { Prisma } from '@prisma/client'

import { conflict, notFound } from '@/lib/api/errors'
import { getPrisma } from '@/lib/prisma'
import { pageMeta, paginate } from '@/lib/services/shared'
import type { MediaInput } from '@/lib/validations/cms'

type MediaRecord = {
  key: string
  url: string
}

function getLocalUploadFilePath(media: MediaRecord) {
  const normalizedKey = media.key.replaceAll('\\', '/')
  const normalizedUrl = media.url.replaceAll('\\', '/')
  const relativePath = normalizedKey.startsWith('uploads/')
    ? normalizedKey
    : normalizedUrl.startsWith('/uploads/')
      ? normalizedUrl.slice(1)
      : null

  if (!relativePath || relativePath.includes('..')) return null

  const publicRoot = path.resolve(process.cwd(), 'public')
  const filePath = path.resolve(publicRoot, ...relativePath.split('/'))

  return filePath.startsWith(`${publicRoot}${path.sep}`) ? filePath : null
}

async function deleteLocalUploadFile(media: MediaRecord) {
  const filePath = getLocalUploadFilePath(media)
  if (!filePath) return

  await rm(filePath, { force: true }).catch(() => undefined)
}

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
    const media = await getPrisma().media.delete({ where: { id } })
    await deleteLocalUploadFile(media)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw notFound('Media item not found.')
    }

    throw error
  }
}

export async function deleteMediaBulk(ids: string[]) {
  const prisma = getPrisma()
  const media = await prisma.media.findMany({ where: { id: { in: ids } } })

  if (media.length === 0) {
    throw notFound('Media items not found.')
  }

  await prisma.media.deleteMany({ where: { id: { in: media.map((item) => item.id) } } })
  await Promise.all(media.map(deleteLocalUploadFile))

  return { count: media.length }
}
