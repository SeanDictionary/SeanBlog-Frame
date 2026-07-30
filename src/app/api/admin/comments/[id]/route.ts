import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { moderateComment, trashComment } from '@/lib/services/comment-service'
import { commentModerationSchema } from '@/lib/validations/cms'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const [{ id }, body] = await Promise.all([params, parseJson(request)])
    const input = commentModerationSchema.parse(body)
    const comment = await moderateComment(id, input)

    return json({ comment })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const { id } = await params
    const comment = await trashComment(id)

    return json({ comment })
  } catch (error) {
    return handleApiError(error)
  }
}
