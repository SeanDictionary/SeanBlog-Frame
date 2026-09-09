/**
 * GitHub 仓库信息拉取 + 进程内缓存，供文章内的 `:::github-repo` 卡片使用。
 *
 * - 服务端拉取（对应 Argon 的 getdata=backend）：markdown 渲染时调 GitHub API。
 * - 进程内缓存（Map + TTL），默认 1h；配合文章页 ISR 5 分钟，首次后基本命中。
 * - 无 token 时 GitHub 限 60 req/h/IP（个人博客几条仓库卡 + 缓存足够）；
 *   可设 GITHUB_TOKEN 环境变量提升至 5000/h。
 * - 任何失败（网络/超时/限流/404）返回 null，调用方渲染降级卡片（仅 author/project + 链接）。
 */

const API = 'https://api.github.com/repos'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 小时
const FETCH_TIMEOUT_MS = 5000

export type GithubRepoData = {
  fullName: string
  htmlUrl: string
  description: string | null
  language: string | null
  stars: number
  forks: number
  ownerLogin: string
  ownerAvatarUrl: string
  ownerHtmlUrl: string
  license: string | null
  topics: string[]
}

const cache = new Map<string, { data: GithubRepoData | null; ts: number }>()

export async function getGithubRepo(owner: string, repo: string): Promise<GithubRepoData | null> {
  const key = `${owner}/${repo}`.toLowerCase()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data

  const data = await fetchRepo(owner, repo)
  cache.set(key, { data, ts: Date.now() })
  return data
}

async function fetchRepo(owner: string, repo: string): Promise<GithubRepoData | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'SeanBlog-Frame',
  }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`${API}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      headers,
      signal: controller.signal,
    })
    if (!res.ok) return null
    const j = await res.json()
    return {
      fullName: j.full_name ?? `${owner}/${repo}`,
      htmlUrl: j.html_url ?? `https://github.com/${owner}/${repo}`,
      description: typeof j.description === 'string' ? j.description : null,
      language: typeof j.language === 'string' ? j.language : null,
      stars: Number(j.stargazers_count ?? 0),
      forks: Number(j.forks_count ?? 0),
      ownerLogin: j.owner?.login ?? owner,
      ownerAvatarUrl: j.owner?.avatar_url ?? '',
      ownerHtmlUrl: j.owner?.html_url ?? `https://github.com/${owner}`,
      license: j.license?.name ?? null,
      topics: Array.isArray(j.topics) ? j.topics : [],
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 主流语言配色（与 GitHub Linguist 大致一致），未命中回退中性灰。 */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5', Go: '#00ADD8',
  Rust: '#dea584', Java: '#b07219', C: '#555555', 'C++': '#f34b7d',
  'C#': '#178600', HTML: '#e34c26', CSS: '#563d7c', SCSS: '#c6538c',
  Shell: '#89e051', Vue: '#41b883', Svelte: '#ff3e00', PHP: '#4F5D95',
  Ruby: '#701516', Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB',
  Lua: '#000080', Dockerfile: '#384d54', Makefile: '#427819', Vuejs: '#41b883',
}

export function languageColor(lang: string | null): string | null {
  if (!lang) return null
  return LANGUAGE_COLORS[lang] ?? '#6b7280'
}
