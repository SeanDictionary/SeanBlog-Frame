// Resolve a visitor-facing country name from an IP address via the
// ipinfo.io lite API. The token is configured in the admin settings; when
// no token is set we skip the request entirely. Private/loopback IPs (local
// dev) are skipped too. Results are cached in memory to avoid repeated
// external calls for the same IP.

const CACHE_TTL = 6 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 10_000
const cache = new Map<string, { country: string | null; expires: number }>()

function pruneExpiredCache(now: number) {
  for (const [key, entry] of cache) {
    if (now >= entry.expires) cache.delete(key)
  }
}

function enforceCacheSize(max: number) {
  while (cache.size > max) {
    const oldestKey = cache.keys().next().value as string | undefined
    if (!oldestKey) return
    cache.delete(oldestKey)
  }
}

export function isPrivateIp(ip: string): boolean {
  return /^(::1|::ffff:|::|0\.0\.0\.0|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|fc|fd|fe80:)/i.test(ip)
}

export async function getCountryByIp(ip?: string | null, token?: string | null): Promise<string | null> {
  if (!ip || !token) return null
  if (isPrivateIp(ip)) return null

  const cached = cache.get(ip)
  if (cached && cached.expires > Date.now()) {
    return cached.country
  }

  pruneExpiredCache(Date.now())

  try {
    const response = await fetch(`https://api.ipinfo.io/lite/${encodeURIComponent(ip)}?token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null

    const data = (await response.json()) as { country?: string; country_name?: string }
    const country = data.country_name ?? data.country ?? null

    cache.set(ip, { country, expires: Date.now() + CACHE_TTL })
    enforceCacheSize(CACHE_MAX_ENTRIES)
    return country
  } catch {
    return null
  }
}
