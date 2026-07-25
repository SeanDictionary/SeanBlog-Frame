import { handleApiError, noContent } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { deleteMedia } from '@/lib/services/media-service'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()

    const { id } = await params
    await deleteMedia(id)

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
