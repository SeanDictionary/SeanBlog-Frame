import { created, handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
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
    await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = mediaInputSchema.parse(body)
    const media = await createMedia(input)

    return created({ media })
  } catch (error) {
    return handleApiError(error)
  }
}
