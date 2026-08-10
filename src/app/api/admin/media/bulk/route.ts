import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { deleteMediaBulk } from '@/lib/services/media-service'
import { mediaBulkDeleteSchema } from '@/lib/validations/cms'

export async function DELETE(request: Request) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = mediaBulkDeleteSchema.parse(body)
    const result = await deleteMediaBulk(input.ids)

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
