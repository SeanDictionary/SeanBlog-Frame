import { handleApiError, json } from '@/lib/api/response'
import { getCategoryBySlug } from '@/lib/services/category-service'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const category = await getCategoryBySlug(slug)

    return json({ category })
  } catch (error) {
    return handleApiError(error)
  }
}
