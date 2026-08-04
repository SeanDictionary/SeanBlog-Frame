import { handleApiError, json, parseJson } from '@/lib/api/response'
import { createAnalyticsEvent } from '@/lib/services/analytics-service'
import { analyticsEventSchema } from '@/lib/validations/cms'

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() ?? null
  return request.headers.get('x-real-ip')
}

export async function POST(request: Request) {
  try {
    const body = await parseJson(request)
    const input = analyticsEventSchema.parse(body)
    const result = await createAnalyticsEvent(input, {
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
