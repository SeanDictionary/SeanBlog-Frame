import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { deleteCategories } from '@/lib/services/category-service'
import { taxonomyBulkDeleteSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = taxonomyBulkDeleteSchema.parse(body)
    const result = await deleteCategories(input.ids)

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
