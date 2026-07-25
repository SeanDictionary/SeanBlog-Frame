import { CommentStatus, Prisma } from '@prisma/client'

import { notFound } from '@/lib/api/errors'
import { getPrisma } from '@/lib/prisma'
import { pageMeta, paginate } from '@/lib/services/shared'
import type { CommentInput } from '@/lib/validations/cms'

export async function createComment(input: CommentInput, request?: Request) {
  const prisma = getPrisma()
  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: { id: true },
  })

  if (!article) {
    throw notFound('Article not found.')
  }

  if (input.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: input.parentId },
      select: { id: true, articleId: true },
    })

    if (!parent || parent.articleId !== input.articleId) {
      throw notFound('Parent comment not found.')
    }
  }

  const forwardedFor = request?.headers.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0]?.trim() || request?.headers.get('x-real-ip') || null

  return prisma.comment.create({
    data: {
      articleId: input.articleId,
      parentId: input.parentId,
      content: input.content,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      ip,
      userAgent: request?.headers.get('user-agent'),
    },
  })
}

export async function listComments(input: {
  page: number
  pageSize: number
  status?: CommentStatus
  articleId?: string
}) {
  const where: Prisma.CommentWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.articleId ? { articleId: input.articleId } : {}),
  }

  const [items, total] = await Promise.all([
    getPrisma().comment.findMany({
      where,
      ...paginate(input.page, input.pageSize),
      orderBy: { createdAt: 'desc' },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    }),
    getPrisma().comment.count({ where }),
  ])

  return {
    items,
    meta: pageMeta(total, input.page, input.pageSize),
  }
}

export async function moderateComment(id: string, input: { status: CommentStatus; isSpam?: boolean }) {
  try {
    return await getPrisma().comment.update({
      where: { id },
      data: {
        status: input.status,
        isSpam: input.isSpam ?? input.status === CommentStatus.SPAM,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw notFound('Comment not found.')
    }

    throw error
  }
}

export async function deleteComment(id: string) {
  return moderateComment(id, {
    status: CommentStatus.TRASHED,
  })
}
