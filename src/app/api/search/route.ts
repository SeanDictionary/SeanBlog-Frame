import { handleApiError, json } from '@/lib/api/response'
import { searchArticles } from '@/lib/services/article-service'
import { searchQuerySchema } from '@/lib/validations/cms'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchQuerySchema.parse(Object.fromEntries(searchParams))
    const result = await searchArticles(query)

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
