import { created, handleApiError, parseJson } from '@/lib/api/response'
import { ApiError } from '@/lib/api/errors'
import { createComment } from '@/lib/services/comment-service'
import { recordOperationLog } from '@/lib/services/operation-log-service'
import { commentInputSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    const body = await parseJson(request)
    const input = commentInputSchema.parse(body)

    try {
      const comment = await createComment(input, request)

      await recordOperationLog({
        actor: { type: 'visitor' },
        module: 'comment',
        action: 'submit',
        targetType: 'comment',
        targetId: comment.id,
        summary: `提交评论：${comment.status}`,
        result: 'SUCCESS',
        metadata: { articleId: comment.articleId, parentId: comment.parentId, status: comment.status },
      })

      return created({ comment })
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        throw error
      }

      await recordOperationLog({
        actor: { type: 'visitor' },
        module: 'comment',
        action: 'submit',
        targetType: 'comment',
        summary: '提交评论失败',
        result: 'FAILURE',
        error,
        metadata: { articleId: input.articleId, parentId: input.parentId },
      })
      throw error
    }
  } catch (error) {
    return handleApiError(error)
  }
}
