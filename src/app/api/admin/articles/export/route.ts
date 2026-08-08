import { badRequest } from '@/lib/api/errors'
import { handleApiError } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { exportAdminArticles } from '@/lib/services/article-service'

export const runtime = 'nodejs'

function parseSelectedIds(searchParams: URLSearchParams) {
  const repeatedIds = searchParams.getAll('id')
  const commaSeparatedIds = searchParams.get('ids')?.split(',') ?? []
  return [...repeatedIds, ...commaSeparatedIds]
    .map((id) => id.trim())
    .filter(Boolean)
}

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const ids = parseSelectedIds(searchParams)

    if (!ids.length) {
      throw badRequest('Select at least one article to export.', 'NO_ARTICLES_SELECTED')
    }

    const payload = await exportAdminArticles({ ids })

    return new Response(payload.buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${payload.filename}"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
