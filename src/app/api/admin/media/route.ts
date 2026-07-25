import { created, handleApiError, json, parseJson } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { createMedia, listMedia } from '@/lib/services/media-service'
import { mediaInputSchema } from '@/lib/validations/cms'

export async function GET() {
  try {
    await requireAdmin()

    const media = await listMedia()
    return json({ media })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const body = await parseJson(request)
    const input = mediaInputSchema.parse(body)
    const media = await createMedia(input)

    return created({ media })
  } catch (error) {
    return handleApiError(error)
  }
}
