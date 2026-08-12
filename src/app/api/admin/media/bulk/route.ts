import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { deleteMediaBulk } from '@/lib/services/media-service'
import { mediaBulkDeleteSchema } from '@/lib/validations/cms'

export async function DELETE(request: Request) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = mediaBulkDeleteSchema.parse(body)
    const result = await recordOperation({
      actor: adminLogActor(session),
      module: 'media',
      action: 'bulk-delete',
      targetType: 'media',
      summary: (operationResult) => `批量删除 ${operationResult.count} 条媒体记录`,
      failureSummary: '批量删除媒体记录失败',
      metadata: { ids: input.ids },
      failureMetadata: { ids: input.ids },
      request,
    }, () => deleteMediaBulk(input.ids))

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
