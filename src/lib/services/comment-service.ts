import { CommentStatus, Prisma } from '@prisma/client'

import { forbidden, notFound, tooManyRequests } from '@/lib/api/errors'
import { checkCommentRateLimit, extractIp, getClientRateLimitIdentifier } from '@/lib/api/rate-limit'
import { canSubmitArticleComments, fromPrismaArticleCommentsMode } from '@/lib/comment-settings'
import { COMMENT_MODERATION_RULES_SETTING_KEY, getCommentModerationDecision, normalizeCommentModerationRules } from '@/lib/comment-moderation-rules'
import { getPrisma } from '@/lib/prisma'
import { pageMeta, paginate } from '@/lib/services/shared'
import { getSiteSettingsMap } from '@/lib/services/setting-service'
import type { CommentInput } from '@/lib/validations/cms'

function toPublicCommentReceipt(comment: {
  id: string
  content: string
  status: CommentStatus
  createdAt: Date
  articleId: string
  parentId: string | null
}) {
  return {
    id: comment.id,
    content: comment.content,
    status: comment.status,
    createdAt: comment.createdAt,
    articleId: comment.articleId,
    parentId: comment.parentId,
  }
}

function toAdminComment(comment: {
  id: string
  content: string
  status: CommentStatus
  guestName: string | null
  guestEmail: string | null
  isSpam: boolean
  createdAt: Date
  updatedAt: Date
  articleId: string
  parentId: string | null
  article?: {
    id: string
    title: string
    slug: string
  }
}) {
  return {
    id: comment.id,
    content: comment.content,
    status: comment.status,
    guestName: comment.guestName,
    guestEmail: comment.guestEmail,
    isSpam: comment.isSpam,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    articleId: comment.articleId,
    parentId: comment.parentId,
    ...(comment.article ? { article: comment.article } : {}),
  }
}

export async function createComment(input: CommentInput, request?: Request) {
  const ip = extractIp(request)

  if (!checkCommentRateLimit(getClientRateLimitIdentifier(request))) {
    throw tooManyRequests('Too many comments. Please try again later.')
  }

  const prisma = getPrisma()
  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: { id: true, commentsMode: true },
  })

  if (!article) {
    throw notFound('Article not found.')
  }

  if (!canSubmitArticleComments(fromPrismaArticleCommentsMode(article.commentsMode))) {
    throw forbidden('New comments are currently closed.')
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

  const settings = await getSiteSettingsMap()
  const moderationDecision = getCommentModerationDecision(
    {
      content: input.content,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
    },
    normalizeCommentModerationRules(settings[COMMENT_MODERATION_RULES_SETTING_KEY]),
  )

  const comment = await prisma.comment.create({
    data: {
      articleId: input.articleId,
      parentId: input.parentId,
      content: input.content,
      status: moderationDecision.status,
      isSpam: moderationDecision.isSpam,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      ip,
      userAgent: request?.headers.get('user-agent'),
    },
  })

  return toPublicCommentReceipt(comment)
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
    items: items.map(toAdminComment),
    meta: pageMeta(total, input.page, input.pageSize),
  }
}

export async function moderateComment(id: string, input: { status: CommentStatus; isSpam?: boolean }) {
  try {
    const comment = await getPrisma().comment.update({
      where: { id },
      data: {
        status: input.status,
        isSpam: input.isSpam ?? input.status === CommentStatus.SPAM,
      },
    })

    return toAdminComment(comment)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw notFound('Comment not found.')
    }

    throw error
  }
}

export async function trashComment(id: string) {
  return moderateComment(id, {
    status: CommentStatus.TRASHED,
  })
}
