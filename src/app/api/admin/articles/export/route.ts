import { handleApiError } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { exportAdminArticles } from '@/lib/services/article-service'
import { articleListQuerySchema } from '@/lib/validations/cms'

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const query = articleListQuerySchema.omit({ page: true, pageSize: true }).parse(Object.fromEntries(searchParams))
    const payload = await exportAdminArticles(query)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="articles-${timestamp}.json"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
