import { handleApiError, json } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { checkTagSlugAvailability } from '@/lib/services/tag-service'

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug') ?? ''
    const name = searchParams.get('name') ?? ''
    const excludeId = searchParams.get('excludeId')?.trim() || undefined
    const result = await checkTagSlugAvailability({ slug, name, excludeId })

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
