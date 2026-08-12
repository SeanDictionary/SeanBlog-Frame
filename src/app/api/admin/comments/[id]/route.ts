import { handleApiError, json, noContent, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { deleteComment, moderateComment } from '@/lib/services/comment-service'
import { commentModerationSchema } from '@/lib/validations/cms'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const [{ id }, body] = await Promise.all([params, parseJson(request)])
    const input = commentModerationSchema.parse(body)
    const comment = await recordOperation({
      actor: adminLogActor(session),
      module: 'comment',
      action: 'moderate',
      targetType: 'comment',
      targetId: id,
      summary: `更新评论状态为 ${input.status}`,
      failureSummary: `更新评论状态失败：${id}`,
      metadata: { status: input.status },
      request,
    }, () => moderateComment(id, input))

    return json({ comment })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const { id } = await params
    await recordOperation({
      actor: adminLogActor(session),
      module: 'comment',
      action: 'delete',
      targetType: 'comment',
      targetId: id,
      summary: `彻底删除评论：${id}`,
      failureSummary: `彻底删除评论失败：${id}`,
      request,
    }, () => deleteComment(id))

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
