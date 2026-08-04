import { created, handleApiError, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { importAdminArticles } from '@/lib/services/article-service'
import { articleImportSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = articleImportSchema.parse({ articles: Array.isArray(body) ? body : body?.articles })
    const result = await importAdminArticles(input)

    return created(result)
  } catch (error) {
    return handleApiError(error)
  }
}
