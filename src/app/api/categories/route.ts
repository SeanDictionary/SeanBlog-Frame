import { handleApiError, json } from '@/lib/api/response'
import { listPublicCategories } from '@/lib/services/category-service'
import { categoryListQuerySchema } from '@/lib/validations/cms'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = categoryListQuerySchema.parse(Object.fromEntries(searchParams))
    const result = await listPublicCategories(query)

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
