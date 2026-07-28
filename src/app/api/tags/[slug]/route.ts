import { handleApiError, json } from '@/lib/api/response'
import { getPublicTagBySlug } from '@/lib/services/tag-service'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const tag = await getPublicTagBySlug(slug)

    return json({ tag })
  } catch (error) {
    return handleApiError(error)
  }
}
