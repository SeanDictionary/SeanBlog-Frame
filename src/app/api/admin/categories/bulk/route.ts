import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { deleteCategories } from '@/lib/services/category-service'
import { taxonomyBulkDeleteSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = taxonomyBulkDeleteSchema.parse(body)
    const result = await recordOperation({
      actor: adminLogActor(session),
      module: 'category',
      action: 'bulk-delete',
      targetType: 'category',
      summary: (operationResult) => `批量删除 ${operationResult.deleted} 个分类`,
      failureSummary: '批量删除分类失败',
      metadata: { ids: input.ids },
      failureMetadata: { ids: input.ids },
      request,
    }, () => deleteCategories(input.ids))

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
