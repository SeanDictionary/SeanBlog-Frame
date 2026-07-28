import { ApiError } from '@/lib/api/errors'

const commentRateLimitMap = new Map<string, { count: number; resetAt: number }>()

const COMMENT_RATE_LIMIT_WINDOW_MS = 60_000
const COMMENT_RATE_LIMIT_MAX = 5

export function checkCommentRateLimit(ip: string | null) {
  if (!ip) {
    throw new ApiError('Unable to determine the client IP address.', 400, 'CLIENT_IP_REQUIRED')
  }

  const now = Date.now()
  const entry = commentRateLimitMap.get(ip)

  if (!entry || now >= entry.resetAt) {
    commentRateLimitMap.set(ip, { count: 1, resetAt: now + COMMENT_RATE_LIMIT_WINDOW_MS })
    return
  }

  entry.count++

  if (entry.count > COMMENT_RATE_LIMIT_MAX) {
    throw new ApiError('Too many comments. Please try again later.', 429, 'RATE_LIMITED')
  }
}

export function extractIp(request?: Request) {
  if (!request) {
    return null
  }

  const forwardedFor = request.headers.get('x-forwarded-for')
  return forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
}
