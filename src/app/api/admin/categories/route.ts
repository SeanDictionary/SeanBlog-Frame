import { created, handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
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
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = categoryInputSchema.parse(body)
    const category = await recordOperation({
      actor: adminLogActor(session),
      module: 'category',
      action: 'create',
      targetType: 'category',
      targetId: (createdCategory) => createdCategory.id,
      summary: (createdCategory) => `创建分类：${createdCategory.name}`,
      failureSummary: `创建分类失败：${input.name}`,
      metadata: (createdCategory) => ({ slug: createdCategory.slug }),
      failureMetadata: { slug: input.slug },
      request,
    }, () => createCategory(input))

    return created({ category })
  } catch (error) {
    return handleApiError(error)
  }
}
