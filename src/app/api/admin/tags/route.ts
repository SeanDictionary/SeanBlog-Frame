import { created, handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { createTag, listTags } from '@/lib/services/tag-service'
import { tagInputSchema } from '@/lib/validations/cms'

export async function GET() {
  try {
    await requireAdmin()

    const tags = await listTags()
    return json({ tags })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = tagInputSchema.parse(body)
    const tag = await recordOperation({
      actor: adminLogActor(session),
      module: 'tag',
      action: 'create',
      targetType: 'tag',
      targetId: (createdTag) => createdTag.id,
      summary: (createdTag) => `创建标签：${createdTag.name}`,
      failureSummary: `创建标签失败：${input.name}`,
      metadata: (createdTag) => ({ slug: createdTag.slug }),
      failureMetadata: { slug: input.slug },
      request,
    }, () => createTag(input))

    return created({ tag })
  } catch (error) {
    return handleApiError(error)
  }
}
