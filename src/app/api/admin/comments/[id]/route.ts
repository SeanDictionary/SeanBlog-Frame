import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { deleteComment, moderateComment } from '@/lib/services/comment-service'
import { commentModerationSchema } from '@/lib/validations/cms'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()

    const [{ id }, body] = await Promise.all([params, parseJson(request)])
    const input = commentModerationSchema.parse(body)
    const comment = await moderateComment(id, input)

    return json({ comment })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()

    const { id } = await params
    const comment = await deleteComment(id)

    return json({ comment })
  } catch (error) {
    return handleApiError(error)
  }
}
