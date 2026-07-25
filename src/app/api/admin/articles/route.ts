import { created, handleApiError, json, parseJson } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { createArticle, listAdminArticles } from '@/lib/services/article-service'
import { articleInputSchema, articleListQuerySchema } from '@/lib/validations/cms'

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const query = articleListQuerySchema.parse(Object.fromEntries(searchParams))
    const result = await listAdminArticles(query)

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const body = await parseJson(request)
    const input = articleInputSchema.parse(body)
    const article = await createArticle(input)

    return created({ article })
  } catch (error) {
    return handleApiError(error)
  }
}
