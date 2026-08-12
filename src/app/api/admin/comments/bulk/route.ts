import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { moderateCommentsBulk } from '@/lib/services/comment-service'
import { commentBulkActionSchema } from '@/lib/validations/cms'

export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = commentBulkActionSchema.parse(body)
    const result = await recordOperation({
      actor: adminLogActor(session),
      module: 'comment',
      action: input.status === 'DELETE' ? 'bulk-delete' : 'bulk-moderate',
      targetType: 'comment',
      summary: (operationResult) => input.status === 'DELETE' ? `批量删除 ${operationResult.count} 条评论` : `批量更新 ${operationResult.count} 条评论为 ${input.status}`,
      failureSummary: input.status === 'DELETE' ? '批量删除评论失败' : `批量更新评论失败：${input.status}`,
      metadata: { ids: input.ids, status: input.status },
      failureMetadata: { ids: input.ids, status: input.status },
      request,
    }, () => moderateCommentsBulk(input))

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
