import { handleApiError, noContent } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { deleteMedia } from '@/lib/services/media-service'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const { id } = await params
    await recordOperation({
      actor: adminLogActor(session),
      module: 'media',
      action: 'delete',
      targetType: 'media',
      targetId: id,
      summary: `删除媒体记录：${id}`,
      failureSummary: `删除媒体记录失败：${id}`,
      request,
    }, () => deleteMedia(id))

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
