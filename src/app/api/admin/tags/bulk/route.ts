import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { deleteTags } from '@/lib/services/tag-service'
import { taxonomyBulkDeleteSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = taxonomyBulkDeleteSchema.parse(body)
    const result = await recordOperation({
      actor: adminLogActor(session),
      module: 'tag',
      action: 'bulk-delete',
      targetType: 'tag',
      summary: (operationResult) => `批量删除 ${operationResult.deleted} 个标签`,
      failureSummary: '批量删除标签失败',
      metadata: { ids: input.ids },
      failureMetadata: { ids: input.ids },
      request,
    }, () => deleteTags(input.ids))

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
