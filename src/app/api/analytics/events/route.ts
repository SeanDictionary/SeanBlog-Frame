import { handleApiError, json, parseJson } from '@/lib/api/response'
import { getCountryByIp } from '@/lib/geoip'
import { createAnalyticsEvent } from '@/lib/services/analytics-service'
import { recordOperationLog } from '@/lib/services/operation-log-service'
import { analyticsEventSchema } from '@/lib/validations/cms'

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() ?? null
  return request.headers.get('x-real-ip')
}

function getHeaderCountry(request: Request) {
  return request.headers.get('x-vercel-ip-country') ?? request.headers.get('cf-ipcountry') ?? null
}

export async function POST(request: Request) {
  try {
    const body = await parseJson(request)
    const input = analyticsEventSchema.parse(body)

    try {
      const ipAddress = getClientIp(request)
      const result = await createAnalyticsEvent(input, {
        ipAddress,
        userAgent: request.headers.get('user-agent'),
        country: (await getCountryByIp(ipAddress)) ?? getHeaderCountry(request),
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
