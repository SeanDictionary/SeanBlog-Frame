import { created, handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { createMedia, listMedia } from '@/lib/services/media-service'
import { mediaInputSchema, mediaListQuerySchema } from '@/lib/validations/cms'

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const query = mediaListQuerySchema.parse(Object.fromEntries(searchParams))
    const result = await listMedia(query)

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = mediaInputSchema.parse(body)
    const media = await recordOperation({
      actor: adminLogActor(session),
      module: 'media',
      action: 'create',
      targetType: 'media',
      targetId: (createdMedia) => createdMedia.id,
      summary: (createdMedia) => `创建媒体记录：${createdMedia.filename}`,
      failureSummary: `创建媒体记录失败：${input.filename}`,
      metadata: (createdMedia) => ({ key: createdMedia.key, mimeType: createdMedia.mimeType, size: createdMedia.size }),
      failureMetadata: { key: input.key, mimeType: input.mimeType, size: input.size },
      request,
    }, () => createMedia(input))

    return created({ media })
  } catch (error) {
    return handleApiError(error)
  }
}
