import { handleApiError, json } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { listComments } from '@/lib/services/comment-service'
import { commentListQuerySchema } from '@/lib/validations/cms'

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const query = commentListQuerySchema.parse(Object.fromEntries(searchParams))
    const result = await listComments(query)

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
