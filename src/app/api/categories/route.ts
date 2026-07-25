import { handleApiError, json } from '@/lib/api/response'
import { listCategories } from '@/lib/services/category-service'

export async function GET() {
  try {
    const categories = await listCategories()

    return json({ categories })
  } catch (error) {
    return handleApiError(error)
  }
}
