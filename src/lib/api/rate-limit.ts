// 速率限制。默认使用进程内存桶；多实例 / Serverless 部署可通过
// `setRateLimitStore` 注入共享实现（如 Redis INCR + EXPIRE），调用方不变。

export type RateLimitBucket = { count: number; resetAt: number }

export interface RateLimitStore {
  get(key: string): RateLimitBucket | undefined
  set(key: string, bucket: RateLimitBucket): void
  delete(key: string): void
  pruneExpired(now: number): void
  /** 桶数量超限时清理最旧条目，避免内存无限增长 */
  enforceSize(max: number): void
}

const DEFAULT_RATE_LIMIT_MAX_BUCKETS = 10_000
const COMMENT_RATE_LIMIT_WINDOW_MS = 60_000
const COMMENT_RATE_LIMIT_MAX = 5
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60_000
const LOGIN_RATE_LIMIT_MAX = 5
const ANALYTICS_RATE_LIMIT_WINDOW_MS = 60_000
const ANALYTICS_RATE_LIMIT_MAX = 60

class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, RateLimitBucket>()

  get(key: string) {
    return this.buckets.get(key)
  }

  set(key: string, bucket: RateLimitBucket) {
    this.buckets.set(key, bucket)
  }

  delete(key: string) {
    this.buckets.delete(key)
  }

  pruneExpired(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key)
      }
    }
  }

  enforceSize(max: number) {
    while (this.buckets.size > max) {
      const oldestKey = this.buckets.keys().next().value as string | undefined
      if (!oldestKey) return
      this.buckets.delete(oldestKey)
    }
  }
}

let store: RateLimitStore = new InMemoryRateLimitStore()

/** 注入共享 store（如 Redis 实现）。默认内存 store 无需调用。 */
export function setRateLimitStore(next: RateLimitStore) {
  store = next
}

function rateLimitKey(scope: string, identifier: string) {
  return `${scope}:${identifier}`
}

function checkRateLimit(key: string, options: { max: number; windowMs: number }) {
  const now = Date.now()
  store.pruneExpired(now)

  const bucket = store.get(key)

  if (!bucket) {
    store.set(key, { count: 1, resetAt: now + options.windowMs })
    store.enforceSize(DEFAULT_RATE_LIMIT_MAX_BUCKETS)
    return true
  }

  bucket.count++

  return bucket.count <= options.max
}

function resetRateLimit(key: string) {
  store.delete(key)
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

/**
 * 解析限流标识。优先 IP（需 TRUST_PROXY_HEADERS）；不可用时回退 visitorId；
 * 都没有则回退 'local-client'。visitorId 兜底避免代理后所有访客共用一个桶。
 */
export function getClientRateLimitIdentifier(request?: Request, visitorId?: string | null) {
  const ip = extractIp(request)
  if (ip) return ip
  if (visitorId) return `visitor:${visitorId}`
  return 'local-client'
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

export function checkAnalyticsRateLimit(identifier: string | null) {
  if (!identifier) {
    return false
  }

  return checkRateLimit(rateLimitKey('analytics', identifier), {
    max: ANALYTICS_RATE_LIMIT_MAX,
    windowMs: ANALYTICS_RATE_LIMIT_WINDOW_MS,
  })
}
