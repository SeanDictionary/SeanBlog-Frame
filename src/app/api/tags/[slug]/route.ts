import { handleApiError, json } from '@/lib/api/response'
import { getTagBySlug } from '@/lib/services/tag-service'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const tag = await getTagBySlug(slug)

    return json({ tag })
  } catch (error) {
    return handleApiError(error)
  }
}
