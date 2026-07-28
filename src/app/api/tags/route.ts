import { handleApiError, json } from '@/lib/api/response'
import { listPublicTags } from '@/lib/services/tag-service'
import { tagListQuerySchema } from '@/lib/validations/cms'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = tagListQuerySchema.parse(Object.fromEntries(searchParams))
    const result = await listPublicTags(query)

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
