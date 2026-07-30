const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

const DEFAULT_RATE_LIMIT_MAX_BUCKETS = 10_000
const COMMENT_RATE_LIMIT_WINDOW_MS = 60_000
const COMMENT_RATE_LIMIT_MAX = 5
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60_000
const LOGIN_RATE_LIMIT_MAX = 5

function rateLimitKey(scope: string, identifier: string) {
  return `${scope}:${identifier}`
}

function pruneExpiredBuckets(now: number) {
  for (const [key, bucket] of rateLimitBuckets) {
    if (now >= bucket.resetAt) {
      rateLimitBuckets.delete(key)
    }
  }
}

function enforceBucketLimit(maxBuckets = DEFAULT_RATE_LIMIT_MAX_BUCKETS) {
  while (rateLimitBuckets.size > maxBuckets) {
    const oldestKey = rateLimitBuckets.keys().next().value as string | undefined

    if (!oldestKey) {
      return
    }

    rateLimitBuckets.delete(oldestKey)
  }
}

function checkRateLimit(key: string, options: { max: number; windowMs: number }) {
  const now = Date.now()
  pruneExpiredBuckets(now)

  const bucket = rateLimitBuckets.get(key)

  if (!bucket) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + options.windowMs })
    enforceBucketLimit()
    return true
  }

  bucket.count++

  return bucket.count <= options.max
}

function resetRateLimit(key: string) {
  rateLimitBuckets.delete(key)
}

function shouldTrustForwardedHeaders() {
  return process.env.TRUST_PROXY_HEADERS === 'true'
}

export function extractIp(request?: Request) {
  if (!request || !shouldTrustForwardedHeaders()) {
    return null
  }

  const trustedForwardedFor = request.headers.get('x-forwarded-for')
  return trustedForwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
}

export function getClientRateLimitIdentifier(request?: Request) {
  return extractIp(request) ?? 'local-client'
}

export function checkCommentRateLimit(identifier: string | null) {
  if (!identifier) {
    return false
  }

  return checkRateLimit(rateLimitKey('comment', identifier), {
    max: COMMENT_RATE_LIMIT_MAX,
    windowMs: COMMENT_RATE_LIMIT_WINDOW_MS,
  })
}

export function checkLoginRateLimit(identifier: string) {
  return checkRateLimit(rateLimitKey('login', identifier), {
    max: LOGIN_RATE_LIMIT_MAX,
    windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  })
}

export function resetLoginRateLimit(identifier: string) {
  resetRateLimit(rateLimitKey('login', identifier))
}
