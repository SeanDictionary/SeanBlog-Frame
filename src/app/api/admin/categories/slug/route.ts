import { handleApiError, json } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { checkCategorySlugAvailability } from '@/lib/services/category-service'

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug') ?? ''
    const name = searchParams.get('name') ?? ''
    const excludeId = searchParams.get('excludeId')?.trim() || undefined
    const result = await checkCategorySlugAvailability({ slug, name, excludeId })

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
