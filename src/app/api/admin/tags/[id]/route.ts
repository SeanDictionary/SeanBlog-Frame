import { handleApiError, json, noContent, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { deleteTag, updateTag } from '@/lib/services/tag-service'
import { tagUpdateSchema } from '@/lib/validations/cms'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const [{ id }, body] = await Promise.all([params, parseJson(request)])
    const input = tagUpdateSchema.parse(body)
    const tag = await updateTag(id, input)

    return json({ tag })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const { id } = await params
    await deleteTag(id)

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
