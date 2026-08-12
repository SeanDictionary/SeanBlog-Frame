import { handleApiError } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { exportOperationLogsCsv } from '@/lib/services/operation-log-service'
import { operationLogQuerySchema } from '@/lib/validations/cms'

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const query = operationLogQuerySchema.parse(Object.fromEntries(searchParams))
    const csv = await exportOperationLogsCsv(query)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="operation-logs-${timestamp}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
