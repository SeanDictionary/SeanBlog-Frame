import { handleApiError, json, noContent, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { deleteTag, updateTag } from '@/lib/services/tag-service'
import { tagUpdateSchema } from '@/lib/validations/cms'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const [{ id }, body] = await Promise.all([params, parseJson(request)])
    const input = tagUpdateSchema.parse(body)
    const tag = await recordOperation({
      actor: adminLogActor(session),
      module: 'tag',
      action: 'update',
      targetType: 'tag',
      targetId: id,
      summary: (updatedTag) => `更新标签：${updatedTag.name}`,
      failureSummary: `更新标签失败：${id}`,
      metadata: (updatedTag) => ({ slug: updatedTag.slug }),
      failureMetadata: { fields: Object.keys(input) },
      request,
    }, () => updateTag(id, input))

    return json({ tag })
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
      module: 'tag',
      action: 'delete',
      targetType: 'tag',
      targetId: id,
      summary: `删除标签：${id}`,
      failureSummary: `删除标签失败：${id}`,
      request,
    }, () => deleteTag(id))

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
