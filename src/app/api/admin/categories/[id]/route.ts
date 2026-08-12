import { handleApiError, json, noContent, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { deleteCategory, updateCategory } from '@/lib/services/category-service'
import { categoryUpdateSchema } from '@/lib/validations/cms'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const [{ id }, body] = await Promise.all([params, parseJson(request)])
    const input = categoryUpdateSchema.parse(body)
    const category = await recordOperation({
      actor: adminLogActor(session),
      module: 'category',
      action: 'update',
      targetType: 'category',
      targetId: id,
      summary: (updatedCategory) => `更新分类：${updatedCategory.name}`,
      failureSummary: `更新分类失败：${id}`,
      metadata: (updatedCategory) => ({ slug: updatedCategory.slug }),
      failureMetadata: { fields: Object.keys(input) },
      request,
    }, () => updateCategory(id, input))

    return json({ category })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const { id } = await params
    await recordOperation({
      actor: adminLogActor(session),
      module: 'category',
      action: 'delete',
      targetType: 'category',
      targetId: id,
      summary: `删除分类：${id}`,
      failureSummary: `删除分类失败：${id}`,
      request,
    }, () => deleteCategory(id))

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
