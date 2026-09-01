import { tooManyRequests } from '@/lib/api/errors'
import { handleApiError, json, parseJson } from '@/lib/api/response'
import { checkAnalyticsRateLimit, extractIp, getClientRateLimitIdentifier } from '@/lib/api/rate-limit'
import { createAnalyticsEvent } from '@/lib/services/analytics-service'
import { recordOperationLog } from '@/lib/services/operation-log-service'
import { analyticsEventSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    const body = await parseJson(request)
    const input = analyticsEventSchema.parse(body)

    // 限流：避免未认证端点被滥用注水浏览量 / 写放大。IP 不可用时回退 visitorId。
    const identifier = getClientRateLimitIdentifier(request, input.visitorId)
    if (!checkAnalyticsRateLimit(identifier)) {
      throw tooManyRequests('Too many analytics events.')
    }

    try {
      // 仅在开启 TRUST_PROXY_HEADERS 时信任 x-forwarded-for，与 rate-limit 一致。
      const ipAddress = extractIp(request)
      const result = await createAnalyticsEvent(input, {
        ipAddress,
        userAgent: request.headers.get('user-agent'),
      })

      return json(result)
    } catch (error) {
      await recordOperationLog({
        actor: { type: 'visitor' },
        module: 'analytics',
        action: 'track-event',
        targetType: 'analytics-event',
        summary: '记录访问统计失败',
        result: 'FAILURE',
        error,
        metadata: { path: input.path, contentType: input.contentType, slug: input.slug },
      })
      throw error
    }
  } catch (error) {
    return handleApiError(error)
  }
}
