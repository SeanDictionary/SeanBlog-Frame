import packageJson from '@/../package.json'
import { handleApiError, json } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'

const REPO = 'SeanDictionary/SeanBlog-Frame'

type VersionCheckResult = {
  current: string
  latest: string | null
  hasUpdate: boolean
  checkedAt: string
}

type CachedCheck = { result: VersionCheckResult; expiresAt: number }

const CACHE_TTL_MS = 5 * 60_000
let cache: CachedCheck | null = null

/** 简单语义化版本比较；无法解析的段视为 0。返回 -1/0/1。 */
function compareSemver(left: string, right: string) {
  const parse = (value: string) => value
    .replace(/^v/i, '')
    .split(/[.+-]/)[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .filter((n) => Number.isFinite(n))
  const l = parse(left)
  const r = parse(right)
  if (!l.length || !r.length) return 0
  for (let i = 0; i < Math.max(l.length, r.length); i += 1) {
    const a = l[i] ?? 0
    const b = r[i] ?? 0
    if (a !== b) return a < b ? -1 : 1
  }
  return 0
}

async function fetchLatestReleaseTag(): Promise<string | null> {
  // GitHub 未授权速率限制 60/小时/IP；调用方已有 5 分钟内存缓存兜底。
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'SeanBlog-Frame' },
    next: { revalidate: 0 },
  })
  if (res.status === 404) return null // 仓库尚无 release
  if (!res.ok) throw new Error(`GitHub releases/latest responded ${res.status}`)
  const data = (await res.json()) as { tag_name?: string }
  return typeof data.tag_name === 'string' && data.tag_name.trim() ? data.tag_name.trim() : null
}

async function performCheck(): Promise<VersionCheckResult> {
  const current = String(packageJson.version)
  const latest = await fetchLatestReleaseTag().catch((error) => {
    console.error('[version] failed to fetch latest release:', error)
    return null
  })
  return {
    current,
    latest,
    hasUpdate: latest ? compareSemver(current, latest) < 0 : false,
    checkedAt: new Date().toISOString(),
  }
}

export async function GET() {
  try {
    await requireAdmin()

    const now = Date.now()
    if (cache && cache.expiresAt > now) {
      return json(cache.result)
    }

    const result = await performCheck()
    cache = { result, expiresAt: now + CACHE_TTL_MS }
    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
