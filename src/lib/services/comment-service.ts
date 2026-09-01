import { CommentStatus, Prisma } from '@prisma/client'

import { forbidden, notFound, tooManyRequests } from '@/lib/api/errors'
import { checkCommentRateLimit, getClientRateLimitIdentifier } from '@/lib/api/rate-limit'
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
  guestLink: string | null
}) {
  return {
    id: comment.id,
    content: comment.content,
    status: comment.status,
    createdAt: comment.createdAt,
    articleId: comment.articleId,
    parentId: comment.parentId,
    guestLink: comment.guestLink,
  }
}

function toAdminComment(comment: {
  id: string
  content: string
  status: CommentStatus
  guestName: string | null
  guestEmail: string | null
  guestLink: string | null
  visitorId: string | null
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
    guestLink: comment.guestLink,
    visitorId: comment.visitorId,
    isSpam: comment.isSpam,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    articleId: comment.articleId,
    parentId: comment.parentId,
    ...(comment.article ? { article: comment.article } : {}),
  }
}

export async function createComment(input: CommentInput, request?: Request) {
  if (!checkCommentRateLimit(getClientRateLimitIdentifier(request, input.visitorId))) {
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
      guestLink: input.guestLink,
    },
    normalizeCommentModerationRules(settings[COMMENT_MODERATION_RULES_SETTING_KEY]),
  )

  const visitorId = input.visitorId ?? null
  if (visitorId) {
    // upsert 避免并发首访 findUnique+create 的 P2002 竞态丢失评论。
    await prisma.visitor.upsert({
      where: { visitorId },
      create: { visitorId },
      update: { lastSeenAt: new Date(), visitCount: { increment: 1 } },
    })
  }

  const comment = await prisma.comment.create({
    data: {
      articleId: input.articleId,
      parentId: input.parentId,
      content: input.content,
      status: moderationDecision.status,
      isSpam: moderationDecision.isSpam,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      guestLink: input.guestLink,
      visitorId,
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

export async function moderateCommentsBulk(input: { ids: string[]; status: CommentStatus | 'DELETE' }) {
  if (input.status === 'DELETE') {
    const result = await getPrisma().comment.deleteMany({
      where: { id: { in: input.ids } },
    })

    return { count: result.count }
  }

  const result = await getPrisma().comment.updateMany({
    where: { id: { in: input.ids } },
    data: {
      status: input.status,
      isSpam: input.status === CommentStatus.SPAM,
    },
  })

  return { count: result.count }
}

export async function deleteComment(id: string) {
  try {
    await getPrisma().comment.delete({ where: { id } })
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

export type FlatReply = {
  id: string
  content: string
  author: string
  link: string | null
  createdAt: Date
  replyToAuthor: string | null
}

export type CommentThread = {
  id: string
  content: string
  author: string
  link: string | null
  createdAt: Date
  replies: FlatReply[]
}

/** 取文章的已审核评论，构建顶级 + 扁平回复线程（支持回复回复，统一挂到顶级下）。
 *  每条回复带 replyToAuthor（直接父评论作者），供主题 @提及 展示。 */
export async function listArticleCommentThread(articleId: string): Promise<CommentThread[]> {
  const rows = await getPrisma().comment.findMany({
    where: { articleId, status: 'APPROVED' },
    select: { id: true, content: true, guestName: true, guestLink: true, createdAt: true, parentId: true },
    orderBy: { createdAt: 'asc' },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))
  const nameOf = (r?: { guestName: string | null }) => (r?.guestName?.trim() || '匿名')

  function topAncestor(id: string): string | null {
    let cur = byId.get(id)
    if (!cur) return null
    const seen = new Set<string>()
    while (cur && cur.parentId) {
      if (seen.has(cur.id)) break
      seen.add(cur.id)
      cur = byId.get(cur.parentId)
    }
    return cur ? cur.id : null
  }

  const threads: CommentThread[] = rows
    .filter((r) => !r.parentId)
    .map((r) => ({
      id: r.id,
      content: r.content,
      author: nameOf(r),
      link: r.guestLink,
      createdAt: r.createdAt,
      replies: [],
    }))
  const threadById = new Map(threads.map((t) => [t.id, t]))

  for (const r of rows) {
    if (!r.parentId) continue
    const topId = topAncestor(r.id)
    const t = topId ? threadById.get(topId) : undefined
    if (!t) continue
    const parent = byId.get(r.parentId)
    t.replies.push({
      id: r.id,
      content: r.content,
      author: nameOf(r),
      link: r.guestLink,
      createdAt: r.createdAt,
      replyToAuthor: parent ? nameOf(parent) : null,
    })
  }
  return threads
}
