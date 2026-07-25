import { created, handleApiError, parseJson } from '@/lib/api/response'
import { createComment } from '@/lib/services/comment-service'
import { commentInputSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    const body = await parseJson(request)
    const input = commentInputSchema.parse(body)
    const comment = await createComment(input, request)

    return created({ comment })
  } catch (error) {
    return handleApiError(error)
  }
}
