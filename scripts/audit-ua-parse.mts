// 审计 UA 解析：从 dev DB 取真实 distinct userAgent，叠加一套覆盖真人/爬虫/国产
// 浏览器的语料，跑当前 parseBrowser/parseOperatingSystem，列出结果与误判。
// 用法：node scripts/audit-ua-parse.mts （Node 24 内置 TS 类型擦除）
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { resolveDatabaseUrl } from './db-url.mjs'
import { parseBrowser, parseOperatingSystem } from '../src/lib/analytics/parse.ts'

type Case = { ua: string; expectBrowser?: string; expectOs?: string; note?: string }

// 覆盖性语料：真人浏览器 × 操作系统、国产浏览器、爬虫。expect 留空表示仅观察不判定。
const CORPUS: Case[] = [
  // —— Edge（强调：Edge 跨平台，Edg/ 是权威信号；Safari/537.36 是所有 Chromium 浏览器的兼容标记）——
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0', expectBrowser: 'Edge', expectOs: 'macOS', note: 'Edge on Mac（合法）' },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0', expectBrowser: 'Edge', expectOs: 'Windows' },
  { ua: 'Mozilla/5.0 (Linux; Android 15; ...) AppleWebKit/537.36 ... Chrome/152.0.0.0 Safari/537.36 EdgA/152.0.0.0', expectBrowser: 'Edge', expectOs: 'Android', note: 'EdgA=Edge Android（当前会被 Chrome 抢匹配吗？Edg/ 不匹配 EdgA/）' },
  // —— Chrome ——
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', expectBrowser: 'Chrome', expectOs: 'Windows' },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', expectBrowser: 'Chrome', expectOs: 'macOS' },
  { ua: 'Mozilla/5.0 (Linux; Android 14; ...) AppleWebKit/537.36 ... Chrome/152.0.0.0 Mobile Safari/537.36', expectBrowser: 'Chrome', expectOs: 'Android' },
  { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/261.1', expectBrowser: 'Safari', expectOs: 'iOS', note: 'iOS Safari（无 Chrome/，有 Safari/）' },
  // —— Firefox ——
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0', expectBrowser: 'Firefox', expectOs: 'Windows' },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:140.0) Gecko/20100101 Firefox/140.0', expectBrowser: 'Firefox', expectOs: 'macOS' },
  // —— Safari（桌面）——
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', expectBrowser: 'Safari', expectOs: 'macOS' },
  // —— 国产/移动浏览器 ——
  { ua: 'Mozilla/5.0 (Linux; Android 16; PKX110 Build/AP3A.240617.008; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/121.0.6167.71 MQQBrowser/6.2 TBS/047935 Mobile Safari/537.36 QQ/9.3.35.39800', expectBrowser: 'QQ浏览器', expectOs: 'Android', note: '当前=Chrome（误判）' },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36 QQBrowser/11.6.5291.400', expectBrowser: 'QQ浏览器', expectOs: 'Windows', note: 'QQ PC 浏览器' },
  { ua: 'Mozilla/5.0 (Linux; Android 14; ...) AppleWebKit/537.36 ... Chrome/120.0.0.0 Mobile Safari/537.36 UCBrowser/13.0.0.1288', expectBrowser: 'UC浏览器', note: '当前=Chrome（误判）' },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36 QIHU 360SE', expectBrowser: '360浏览器', note: '当前=Chrome（误判）' },
  { ua: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36 SE 2.X MetaSr 1.0', expectBrowser: '搜狗浏览器', note: '当前=Chrome（误判）' },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LBBROWSER', expectBrowser: '猎豹浏览器', note: '当前=Chrome（误判）' },
  { ua: 'Mozilla/5.0 (Linux; Android 14; ...) AppleWebKit/537.36 ... Chrome/119.0.0.0 Mobile Safari/537.36 baiduboxapp/13.0.0.0', expectBrowser: '百度浏览器', note: '当前=Chrome（误判）' },
  // —— 爬虫 ——
  { ua: 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)', expectBrowser: '爬虫', expectOs: '其他系统', note: 'Meta/Facebook 爬虫，当前=其他浏览器（误判）' },
  { ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', expectBrowser: '爬虫', note: 'Facebook 爬虫（旧 token）' },
  { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', expectBrowser: '爬虫', expectOs: '其他系统', note: 'Googlebot（带 Mozilla/5.0 与 Safari/537.36 兼容头，易误判为 Chrome/Safari？无 Chrome/）' },
  { ua: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/120.0.6099.28 Mobile Safari/537.36', expectBrowser: '爬虫', expectOs: 'Android', note: 'Googlebot Smartphone（带 Chrome/ + Android，极易误判为 Chrome/Android）' },
  { ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', expectBrowser: '爬虫' },
  { ua: 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)', expectBrowser: '爬虫' },
  { ua: 'Mozilla/5.0 (compatible; Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07))', expectBrowser: '爬虫' },
  { ua: 'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)', expectBrowser: '爬虫', note: '字节/TikTok' },
  { ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)', expectBrowser: '爬虫' },
  { ua: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', expectBrowser: '爬虫' },
  { ua: 'Mozilla/5.0 (compatible; Twitterbot/1.0)', expectBrowser: '爬虫' },
  { ua: 'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)', expectBrowser: '爬虫' },
  { ua: 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)', expectBrowser: '爬虫' },
  { ua: 'Mozilla/5.0 (compatible; AhrefsBot/12.1; +http://ahrefs.com/robot/)', expectBrowser: '爬虫' },
  { ua: 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)', expectBrowser: '爬虫' },
  { ua: 'Mozilla/5.0 (compatible; DuckDuckBot/1.1; +http://duckduckgo.com/duckduckbot.html)', expectBrowser: '爬虫' },
  { ua: 'Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)', expectBrowser: '爬虫' },
  { ua: 'Mozilla/5.0 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)', expectBrowser: '爬虫', note: '华为' },
]

function trunc(s: string, n = 96) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function verdict(actual: string, expected: string | undefined) {
  if (!expected) return '—'
  return actual === expected ? '✓' : `✗ 应=${expected}`
}

async function main() {
  console.log('==== 覆盖性语料 ====')
  let fail = 0
  for (const c of CORPUS) {
    const b = parseBrowser(c.ua)
    const o = parseOperatingSystem(c.ua)
    const bv = verdict(b, c.expectBrowser)
    const ov = verdict(o, c.expectOs)
    if (bv !== '✓' && bv !== '—') fail++
    if (ov !== '✓' && ov !== '—') fail++
    const tag = (bv === '✓' && (ov === '✓' || ov === '—')) ? 'OK' : 'MISMATCH'
    console.log(`[${tag}] browser=${b.padEnd(10)} os=${o.padEnd(10)} | ${c.note ?? ''}`)
    console.log(`         UA: ${trunc(c.ua)}`)
  }
  console.log(`\n语料误判行数（browser/os 之一不符）：${fail}\n`)

  console.log('==== dev DB 真实 distinct userAgent（按计数降序）====')
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseUrl() }) })
  try {
    const rows: Array<{ userAgent: string; count: bigint }> = await prisma.$queryRawUnsafe(
      `SELECT "userAgent" AS "userAgent", COUNT(*)::bigint AS "count" FROM "AnalyticsEvent" WHERE "userAgent" IS NOT NULL AND "userAgent" <> '' GROUP BY "userAgent" ORDER BY COUNT(*) DESC LIMIT 200`,
    )
    for (const r of rows) {
      const b = parseBrowser(r.userAgent)
      const o = parseOperatingSystem(r.userAgent)
      console.log(`n=${String(r.count).padStart(4)} | browser=${b.padEnd(10)} os=${o.padEnd(10)} | ${trunc(r.userAgent)}`)
    }
    console.log(`\n共 ${rows.length} 个 distinct UA（最多前 200）`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
