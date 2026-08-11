import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { moderateCommentsBulk } from '@/lib/services/comment-service'
import { commentBulkActionSchema } from '@/lib/validations/cms'

export async function PATCH(request: Request) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = commentBulkActionSchema.parse(body)
    const result = await moderateCommentsBulk(input)

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
