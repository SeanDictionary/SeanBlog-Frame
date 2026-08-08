import { badRequest } from '@/lib/api/errors'
import { created, handleApiError } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { importAdminArticlesArchive } from '@/lib/services/article-service'

export const runtime = 'nodejs'

const MAX_IMPORT_BYTES = 25 * 1024 * 1024

export async function POST(request: Request) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      throw badRequest('ZIP file is required.', 'MISSING_FILE')
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      throw badRequest('Article import must be a .zip file.', 'INVALID_IMPORT_FILE')
    }

    if (file.size <= 0 || file.size > MAX_IMPORT_BYTES) {
      throw badRequest('ZIP file must be between 1 byte and 25 MB.', 'INVALID_FILE_SIZE')
    }

    const result = await importAdminArticlesArchive(Buffer.from(await file.arrayBuffer()))

    return created(result)
  } catch (error) {
    return handleApiError(error)
  }
}
