import { handleApiError, json } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { listMedia } from '@/lib/services/media-service'
import { mediaListQuerySchema } from '@/lib/validations/cms'

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const query = mediaListQuerySchema.parse(Object.fromEntries(searchParams))
    const result = await listMedia(query)

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
