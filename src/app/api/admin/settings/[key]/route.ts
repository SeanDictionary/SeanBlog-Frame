import { revalidatePath } from 'next/cache'

import { badRequest } from '@/lib/api/errors'
import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { getSetting, upsertSetting } from '@/lib/services/setting-service'
import { themeExists } from '@/lib/theme'
import { settingInputSchema } from '@/lib/validations/cms'
import { assertThemeName } from '@/lib/validations/theme'

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    await requireAdmin()

    const { key } = await params
    const setting = await getSetting(key)

    return json({ setting })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const [{ key }, body] = await Promise.all([params, parseJson(request)])
    const input = settingInputSchema.parse(body)

    const setting = await recordOperation({
      actor: adminLogActor(session),
      module: 'setting',
      action: 'update',
      targetType: 'setting',
      targetId: key,
      summary: `更新设置：${key}`,
      failureSummary: `更新设置失败：${key}`,
      metadata: { key },
      request,
    }, async () => {
      if (key === 'activeTheme') {
        const themeName = assertThemeName(input.value)

        if (!(await themeExists(themeName))) {
          throw badRequest('The selected theme does not exist.', 'THEME_NOT_FOUND')
        }
      }

      return upsertSetting(key, input.value)
    })

    if (key === 'activeTheme' || key.startsWith('publicHeader') || key.startsWith('publicFooter') || key.startsWith('theme')) {
      revalidatePath('/(public)', 'layout')
    }

    if (key.startsWith('adminSidebar')) {
      revalidatePath('/admin', 'layout')
    }

    if (key === 'adminDashboardCards') {
      revalidatePath('/admin')
    }

    return json({ setting })
  } catch (error) {
    return handleApiError(error)
  }
}
