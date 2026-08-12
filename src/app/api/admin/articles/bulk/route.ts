import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { bulkUpdateArticles } from '@/lib/services/article-service'
import { articleBulkActionSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = articleBulkActionSchema.parse(body)
    const result = await recordOperation({
      actor: adminLogActor(session),
      module: 'article',
      action: `bulk-${input.action}`,
      targetType: 'article',
      summary: (operationResult) => `批量${input.action} ${operationResult.count} 篇文章`,
      failureSummary: `批量${input.action}文章失败`,
      metadata: { ids: input.ids, action: input.action },
      failureMetadata: { ids: input.ids, action: input.action },
      request,
    }, () => bulkUpdateArticles(input))

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
