import { created, handleApiError, parseJson } from '@/lib/api/response'
import { ApiError } from '@/lib/api/errors'
import { createComment } from '@/lib/services/comment-service'
import { commentInputSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    const body = await parseJson(request)
    const input = commentInputSchema.parse(body)

    try {
      const comment = await createComment(input, request)
      return created({ comment })
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        throw error
      }
      throw error
    }
  } catch (error) {
    return handleApiError(error)
  }
}
