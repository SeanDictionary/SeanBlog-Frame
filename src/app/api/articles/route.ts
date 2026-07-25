import { handleApiError, json } from '@/lib/api/response'
import { listPublicArticles } from '@/lib/services/article-service'
import { publicArticleListQuerySchema } from '@/lib/validations/cms'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = publicArticleListQuerySchema.parse(Object.fromEntries(searchParams))
    const result = await listPublicArticles(query)

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
