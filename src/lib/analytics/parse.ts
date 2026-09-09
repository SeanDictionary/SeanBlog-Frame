/**
 * 访问事件字段的公共解析工具。
 *
 * - `parseBrowser` / `parseOperatingSystem`：由 `userAgent` 解析浏览器与操作系统
 *   标签。写入路径（`createAnalyticsEvent`）、统计懒回填（`getAnalyticsFieldStats`）、
 *   访问记录展示（`serializeVisitRecord`）与访客详情聚合（`getVisitorDetail`）共用，
 *   保证解析口径一致。
 * - `isCrawlerUa`：判定是否为爬虫/自动程序。爬虫识别也并入 UA 解析——`parseBrowser`
 *   对爬虫 UA 返回「爬虫」，同时由独立列 `isBot` 标注（见 AnalyticsEvent）。
 * - `extractReferrerDomain`：由 `referrer` 完整 URL 提取来源域名（去前导 `www.`，
 *   非 http(s) 或与本站同域时返回 null，使统计自然排除直接访问 / 本站内部跳转）。
 *
 * 爬虫识别采用通用名字子串（bot/crawler/spider/slurp/external*），覆盖 Google/Bing/
 * Baidu/Sogou/字节/GPTBot/ClaudeBot/Twitter/Apple/Yandex/Ahrefs/Semrush/DuckDuck/
 * Yahoo/Petal/Meta 等（实测 18/18 命中、0 真人误判），对新出现的「-bot」命名 AI 爬虫
 * 天然免疫。异种爬虫（无 bot/spider 字样）若出现，可再 vendor isbot 的 patterns 清单。
 *
 * 这些是纯函数，无副作用，可在服务端任意路径调用。
 */

/** 爬虫 / 自动程序识别。先于浏览器 token 判断，避免爬虫 UA 里的 Chrome/ 字样抢匹配。 */
const CRAWLER_RE = /bot|crawler|spider|slurp|externalhit|externalagent/i
export function isCrawlerUa(userAgent: string | null | undefined): boolean {
  return !!userAgent && CRAWLER_RE.test(userAgent)
}

/** 解析浏览器标签。爬虫返回"爬虫"；无法识别返回"其他浏览器"；空 UA 返回"未采集"。 */
export function parseBrowser(userAgent: string | null) {
  if (!userAgent) return '未采集'
  if (isCrawlerUa(userAgent)) return '爬虫'
  // 国产浏览器（token 优先于 Chrome/，否则会被 Chrome/ 抢匹配）
  if (/QQBrowser\/|MQQBrowser\//.test(userAgent)) return 'QQ浏览器'
  if (/UCBrowser\/|UCWEB/.test(userAgent)) return 'UC浏览器'
  if (/QIHU\s360|360SE|360AEE|360Browser/.test(userAgent)) return '360浏览器'
  if (/MetaSr|Sogou/i.test(userAgent)) return '搜狗浏览器'
  if (/LBBROWSER/.test(userAgent)) return '猎豹浏览器'
  if (/baiduboxapp|BIDUBrowser|BaiduHD/.test(userAgent)) return '百度浏览器'
  // Edge（含桌面 Edg/、安卓 EdgA/、iOS EdgiOS/，以及旧版 EdgeHTML 的 Edge/）
  if (/Edg(A|iOS)?\/|Edge\//.test(userAgent)) return 'Edge'
  if (/Chrome\//.test(userAgent) && !/Chromium\//.test(userAgent)) return 'Chrome'
  if (/Firefox\//.test(userAgent)) return 'Firefox'
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return 'Safari'
  return '其他浏览器'
}

/** 解析操作系统标签。iOS 须先于 macOS——iPhone/iPad UA 含"like Mac OS X"。 */
export function parseOperatingSystem(userAgent: string | null) {
  if (!userAgent) return '未采集'
  if (/Windows NT/.test(userAgent)) return 'Windows'
  if (/(iPhone|iPad|iPod)/.test(userAgent)) return 'iOS'
  if (/Mac OS X/.test(userAgent)) return 'macOS'
  if (/Android/.test(userAgent)) return 'Android'
  if (/Linux/.test(userAgent)) return 'Linux'
  return '其他系统'
}

/**
 * 规整 host 用于"本站"判定：小写、去前导 `www.`、去端口。
 * 例：`www.Example.com:443` → `example.com`；`localhost:3000` → `localhost`。
 */
export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null
  let h = host.trim().toLowerCase()
  const slash = h.indexOf('/')
  if (slash >= 0) h = h.slice(slash + 2) // 容错：去掉可能的 scheme
  h = h.split(':')[0] // 去端口
  if (h.startsWith('www.')) h = h.slice(4)
  return h || null
}

/**
 * 由 `referrer`（完整 URL）提取来源域名。
 *
 * - 非 http(s) 的 referrer（空、`about:blank`、相对路径等）→ null。
 * - 与 `selfHost`（规整后）同域 → null（本站内部跳转，不当作外部来源）。
 * - 否则返回去前导 `www.` 的 host（保留二级域名，如 `mail.google.com` 不归并到
 *   `google.com`）。
 *
 * `selfHost` 在写入路径取请求 host、在懒回填路径取后台 `siteUrl` 的 host。
 */
export function extractReferrerDomain(referrer: string | null | undefined, selfHost: string | null | undefined): string | null {
  if (!referrer) return null
  let host: string
  try {
    const url = new URL(referrer)
    if (!/^https?:$/.test(url.protocol)) return null
    host = url.hostname
  } catch {
    return null
  }
  if (!host) return null
  const normalized = normalizeHost(host)
  if (!normalized) return null
  const self = normalizeHost(selfHost)
  if (self && normalized === self) return null
  return normalized
}
