import { handleApiError, json } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { getAnalyticsFieldStats } from '@/lib/services/analytics-service'
import { analyticsFieldStatsQuerySchema } from '@/lib/validations/cms'

// 各访问来源字段的分布统计（地区 / 来源站点 / 操作系统 / 浏览器），跟随 start/end
// 日期范围。统计前懒回填派生列（referrerDomain / operatingSystem / browser），
// 使结果不依赖回填是否预热。仅 admin。
export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const query = analyticsFieldStatsQuerySchema.parse(Object.fromEntries(searchParams))
    const data = await getAnalyticsFieldStats(query.field, { start: query.start, end: query.end })

    return json(data)
  } catch (error) {
    return handleApiError(error)
  }
}
