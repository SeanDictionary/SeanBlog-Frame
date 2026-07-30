import { handleApiError, json, noContent, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { deleteCategory, updateCategory } from '@/lib/services/category-service'
import { categoryUpdateSchema } from '@/lib/validations/cms'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const [{ id }, body] = await Promise.all([params, parseJson(request)])
    const input = categoryUpdateSchema.parse(body)
    const category = await updateCategory(id, input)

    return json({ category })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const { id } = await params
    await deleteCategory(id)

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
