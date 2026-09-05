import { Prisma } from '@prisma/client'

import { conflict, notFound } from '@/lib/api/errors'
import { deleteUploadByUrl } from '@/lib/media/storage'
import { getPrisma } from '@/lib/prisma'
import { pageMeta, paginate } from '@/lib/services/shared'
import type { MediaInput } from '@/lib/validations/cms'

type MediaRecord = {
  key: string
  url: string
}

async function deleteLocalUploadFile(media: MediaRecord) {
  // 按 url 解析磁盘路径并删除；非本地上传（url 不以 /uploads/ 开头）静默跳过。
  await deleteUploadByUrl(media.url)
}

export async function listMedia(input: { page: number; pageSize: number; q?: string | null }) {
  const prisma = getPrisma()
  const where: Prisma.MediaWhereInput = input.q
    ? {
        OR: [
          { filename: { contains: input.q, mode: 'insensitive' } },
          { key: { contains: input.q, mode: 'insensitive' } },
        ],
      }
    : {}

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
