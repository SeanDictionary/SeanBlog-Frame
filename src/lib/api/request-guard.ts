import { forbidden } from '@/lib/api/errors'
import { getSiteUrlSync } from '@/lib/services/setting-service'

const ALLOWED_FETCH_SITES = new Set(['same-origin', 'same-site', 'none'])

function safeNormalizeOrigin(value: string) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function getAllowedOrigins(request: Request) {
  const requestOrigin = safeNormalizeOrigin(request.url)
  const origins = new Set<string>()

  if (requestOrigin) {
    origins.add(requestOrigin)
  }

  // 站点 URL 现来自后台设置；缓存由 root layout 的 generateMetadata 预热。
  // 缓存未预热时（冷启动直击 admin API，实际罕见）返回 null，
  // 此时仅靠 requestOrigin 校验，与未配置时行为一致。
  const configuredSiteUrl = getSiteUrlSync()
  const configuredOrigin = configuredSiteUrl ? safeNormalizeOrigin(configuredSiteUrl) : null

  if (configuredOrigin) {
    origins.add(configuredOrigin)
  }

  return origins
}

export function requireSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin')

  if (origin) {
    const normalizedOrigin = safeNormalizeOrigin(origin)

    if (!normalizedOrigin || !getAllowedOrigins(request).has(normalizedOrigin)) {
      throw forbidden('Cross-site admin requests are not allowed.')
    }

    return
  }

  const fetchSite = request.headers.get('sec-fetch-site')

  if (!fetchSite || !ALLOWED_FETCH_SITES.has(fetchSite)) {
    throw forbidden('Cross-site admin requests are not allowed.')
  }
}
