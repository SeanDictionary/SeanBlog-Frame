import { handleApiError } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { exportAnalyticsCsv } from '@/lib/services/analytics-service'
import { analyticsQuerySchema } from '@/lib/validations/cms'

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const query = analyticsQuerySchema.parse(Object.fromEntries(searchParams))
    const csv = await exportAnalyticsCsv(query)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="analytics-${timestamp}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
