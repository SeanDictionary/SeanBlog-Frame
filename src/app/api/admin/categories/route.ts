import { created, handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { createCategory, listCategories } from '@/lib/services/category-service'
import { categoryInputSchema } from '@/lib/validations/cms'

export async function GET() {
  try {
    await requireAdmin()

    const categories = await listCategories()
    return json({ categories })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = categoryInputSchema.parse(body)
    const category = await createCategory(input)

    return created({ category })
  } catch (error) {
    return handleApiError(error)
  }
}
