import { created, handleApiError, json, parseJson } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { createTag, listTags } from '@/lib/services/tag-service'
import { tagInputSchema } from '@/lib/validations/cms'

export async function GET() {
  try {
    await requireAdmin()

    const tags = await listTags()
    return json({ tags })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const body = await parseJson(request)
    const input = tagInputSchema.parse(body)
    const tag = await createTag(input)

    return created({ tag })
  } catch (error) {
    return handleApiError(error)
  }
}
