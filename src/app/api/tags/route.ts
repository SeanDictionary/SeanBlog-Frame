import { handleApiError, json } from '@/lib/api/response'
import { listTags } from '@/lib/services/tag-service'

export async function GET() {
  try {
    const tags = await listTags()

    return json({ tags })
  } catch (error) {
    return handleApiError(error)
  }
}
