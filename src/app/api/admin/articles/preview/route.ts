import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { markdownToHtml } from '@/lib/content/markdown'
import { markdownPreviewSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = markdownPreviewSchema.parse(body)
    const html = await markdownToHtml(input.markdown)

    return json({ html })
  } catch (error) {
    return handleApiError(error)
  }
}
