import { handleApiError, json } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { listOperationLogs } from '@/lib/services/operation-log-service'
import { operationLogQuerySchema } from '@/lib/validations/cms'

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const query = operationLogQuerySchema.parse(Object.fromEntries(searchParams))
    const result = await listOperationLogs(query)

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
