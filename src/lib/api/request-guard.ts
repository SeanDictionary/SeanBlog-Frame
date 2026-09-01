import { forbidden } from '@/lib/api/errors'
import { siteUrl } from '@/lib/env'

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

  const configuredOrigin = siteUrl ? safeNormalizeOrigin(siteUrl) : null

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
