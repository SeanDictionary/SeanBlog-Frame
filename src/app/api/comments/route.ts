import { created, handleApiError, parseJson } from '@/lib/api/response'
import { createComment } from '@/lib/services/comment-service'
import { recordOperation } from '@/lib/services/operation-log-service'
import { commentInputSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    const body = await parseJson(request)
    const input = commentInputSchema.parse(body)
    const comment = await recordOperation({
      actor: { type: 'visitor' },
      module: 'comment',
      action: 'submit',
      targetType: 'comment',
      targetId: (createdComment) => createdComment.id,
      summary: (createdComment) => `提交评论：${createdComment.status}`,
      failureSummary: '提交评论失败',
      metadata: (createdComment) => ({ articleId: createdComment.articleId, parentId: createdComment.parentId, status: createdComment.status }),
      failureMetadata: { articleId: input.articleId, parentId: input.parentId },
      request,
    }, () => createComment(input, request))

    return created({ comment })
  } catch (error) {
    return handleApiError(error)
  }
}
