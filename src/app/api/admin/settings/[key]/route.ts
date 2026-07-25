import { handleApiError, json, parseJson } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { getSetting, upsertSetting } from '@/lib/services/setting-service'
import { settingInputSchema } from '@/lib/validations/cms'

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
    await requireAdmin()

    const [{ key }, body] = await Promise.all([params, parseJson(request)])
    const input = settingInputSchema.parse(body)
    const setting = await upsertSetting(key, input.value)

    return json({ setting })
  } catch (error) {
    return handleApiError(error)
  }
}
