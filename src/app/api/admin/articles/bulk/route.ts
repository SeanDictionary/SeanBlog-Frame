import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { bulkUpdateArticles } from '@/lib/services/article-service'
import { articleBulkActionSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = articleBulkActionSchema.parse(body)
    const result = await bulkUpdateArticles(input)

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
