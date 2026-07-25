import { handleApiError, json } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { listSettings } from '@/lib/services/setting-service'

export async function GET() {
  try {
    await requireAdmin()

    const settings = await listSettings()
    return json({ settings })
  } catch (error) {
    return handleApiError(error)
  }
}
