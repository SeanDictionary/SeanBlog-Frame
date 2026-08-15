import { revalidatePath } from 'next/cache'

import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { listSettings, upsertSettings } from '@/lib/services/setting-service'
import { settingBulkUpdateSchema } from '@/lib/validations/cms'

const settingScopeLabels = {
  analytics: '访问统计设置',
  'article-meta': '文章元数据设置',
} satisfies Record<string, string>

function revalidateSettings(keys: string[]) {
  if (keys.some((key) => key.startsWith('analytics'))) {
    revalidatePath('/admin/analytics')
    revalidatePath('/admin/analytics/overview')
    revalidatePath('/admin/analytics/visitors')
  }

  if (keys.some((key) => key.startsWith('articleMeta'))) {
    revalidatePath('/articles/[slug]', 'page')
  }
}

export async function GET() {
  try {
    await requireAdmin()

    const settings = await listSettings()
    return json({ settings })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const body = await parseJson(request)
    const input = settingBulkUpdateSchema.parse(body)
    const keys = input.updates.map((update) => update.key)
    const settings = await recordOperation({
      actor: adminLogActor(session),
      module: 'setting',
      action: 'bulk-update',
      targetType: 'setting-group',
      targetId: input.scope,
      summary: `更新${settingScopeLabels[input.scope]}`,
      failureSummary: `更新${settingScopeLabels[input.scope]}失败`,
      metadata: { scope: input.scope, keys, count: keys.length },
      failureMetadata: { scope: input.scope, keys, count: keys.length },
      request,
    }, () => upsertSettings(input.updates))

    revalidateSettings(keys)

    return json({ settings })
  } catch (error) {
    return handleApiError(error)
  }
}
