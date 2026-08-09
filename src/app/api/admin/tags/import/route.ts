import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { importTags } from '@/lib/services/tag-service'
import { taxonomyImportSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = taxonomyImportSchema.parse(body)
    const items = await importTags(input)

    return json({ items })
  } catch (error) {
    return handleApiError(error)
  }
}
