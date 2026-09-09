// 种子：插入爬虫 + 真人（UA 取自 useragentstring.com + 常见爬虫）访问记录，
// 派生列（isBot/browser/os/referrerDomain）留 NULL，然后复用 parse.ts 跑懒回填，
// 最后校验落库的 browser/os/isBot/referrerDomain 是否与预期一致。
// 用法：node --experimental-strip-types scripts/seed-ua-test.mts
// 清理：DELETE FROM "AnalyticsEvent" WHERE "path" = '/__ua_seed__';
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { resolveDatabaseUrl } from './db-url.mjs'
import { extractReferrerDomain, isCrawlerUa, parseBrowser, parseOperatingSystem } from '../src/lib/analytics/parse.ts'

type Row = { ua: string; expectBrowser: string; expectOs: string; expectIsBot: boolean; referrer: string | null; expectDomain: string | null; country: string | null }

// 真人 UA 取自 useragentstring.com（Chrome/Safari/Firefox/Edge 页）+ 常见爬虫
const ROWS: Row[] = [
  // —— 真人（Chrome）——
  { ua: 'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.166 Safari/537.36', expectBrowser: 'Chrome', expectOs: 'Windows', expectIsBot: false, referrer: 'https://www.google.com/search?q=seanblog', expectDomain: 'google.com', country: '美国' },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_6_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.5615.50 Safari/537.36', expectBrowser: 'Chrome', expectOs: 'macOS', expectIsBot: false, referrer: null, expectDomain: null, country: '中国' },
  { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.5060.53 Safari/537.36', expectBrowser: 'Chrome', expectOs: 'Linux', expectIsBot: false, referrer: 'https://github.com/sean', expectDomain: 'github.com', country: '美国' },
  // —— 真人（Safari / iOS）——
  { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Mobile/15E148 Safari/604.1', expectBrowser: 'Safari', expectOs: 'iOS', expectIsBot: false, referrer: 'https://www.baidu.com/s?wd=seanblog', expectDomain: 'baidu.com', country: '中国' },
  { ua: 'Mozilla/5.0 (iPad; CPU OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5355d Safari/8536.25', expectBrowser: 'Safari', expectOs: 'iOS', expectIsBot: false, referrer: null, expectDomain: null, country: '日本' },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.75.14 (KHTML, like Gecko) Version/7.0.3 Safari/7046A194A', expectBrowser: 'Safari', expectOs: 'macOS', expectIsBot: false, referrer: 'https://duckduckgo.com/', expectDomain: 'duckduckgo.com', country: '美国' },
  // —— 真人（Firefox）——
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0', expectBrowser: 'Firefox', expectOs: 'Windows', expectIsBot: false, referrer: null, expectDomain: null, country: '德国' },
  { ua: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0', expectBrowser: 'Firefox', expectOs: 'Linux', expectIsBot: false, referrer: 'https://www.bing.com/search', expectDomain: 'bing.com', country: '美国' },
  // —— 真人（Edge：新版 Edg/ + 旧版 EdgeHTML Edge/）——
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0', expectBrowser: 'Edge', expectOs: 'macOS', expectIsBot: false, referrer: 'https://t.co/seanblog', expectDomain: 't.co', country: '美国' },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.19582', expectBrowser: 'Edge', expectOs: 'Windows', expectIsBot: false, referrer: 'https://mail.google.com/', expectDomain: 'mail.google.com', country: '美国' },
  // —— 本站内部跳转（referrer 同域，应被排除 → referrerDomain=null）——
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', expectBrowser: 'Chrome', expectOs: 'Windows', expectIsBot: false, referrer: 'http://localhost:3000/articles/welcome', expectDomain: null, country: '中国' },
  // —— 爬虫 ——
  { ua: 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)', expectBrowser: '爬虫', expectOs: '其他系统', expectIsBot: true, referrer: null, expectDomain: null, country: '美国' },
  { ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', expectBrowser: '爬虫', expectOs: '其他系统', expectIsBot: true, referrer: null, expectDomain: null, country: '美国' },
  { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', expectBrowser: '爬虫', expectOs: '其他系统', expectIsBot: true, referrer: null, expectDomain: null, country: '美国' },
  { ua: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/120.0.6099.28 Mobile Safari/537.36', expectBrowser: '爬虫', expectOs: 'Android', expectIsBot: true, referrer: null, expectDomain: null, country: '美国' },
  { ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', expectBrowser: '爬虫', expectOs: '其他系统', expectIsBot: true, referrer: null, expectDomain: null, country: '美国' },
  { ua: 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)', expectBrowser: '爬虫', expectOs: '其他系统', expectIsBot: true, referrer: null, expectDomain: null, country: '中国' },
  { ua: 'Mozilla/5.0 (compatible; Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07))', expectBrowser: '爬虫', expectOs: '其他系统', expectIsBot: true, referrer: null, expectDomain: null, country: '中国' },
  { ua: 'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)', expectBrowser: '爬虫', expectOs: '其他系统', expectIsBot: true, referrer: null, expectDomain: null, country: '中国' },
  { ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)', expectBrowser: '爬虫', expectOs: '其他系统', expectIsBot: true, referrer: null, expectDomain: null, country: '美国' },
  { ua: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', expectBrowser: '爬虫', expectOs: '其他系统', expectIsBot: true, referrer: null, expectDomain: null, country: '美国' },
  { ua: 'Mozilla/5.0 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)', expectBrowser: '爬虫', expectOs: '其他系统', expectIsBot: true, referrer: null, expectDomain: null, country: '中国' },
  { ua: 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)', expectBrowser: '爬虫', expectOs: '其他系统', expectIsBot: true, referrer: null, expectDomain: null, country: '俄罗斯' },
  { ua: 'Mozilla/5.0 (compatible; AhrefsBot/12.1; +http://ahrefs.com/robot/)', expectBrowser: '爬虫', expectOs: '其他系统', expectIsBot: true, referrer: null, expectDomain: null, country: '新加坡' },
]

function trunc(s: string, n = 88) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseUrl() }) })
  const PATH = '/__ua_seed__'
  // 清理旧种子
  await prisma.analyticsEvent.deleteMany({ where: { path: PATH } })

  // 解析 siteUrl → 本站 host（用于 referrerDomain 自愈的本站排除）。
  // value 可能是裸 URL 或 JSON 串，统一用正则提 http(s)://...，避免反序列化差异。
  let selfHost: string | null = null
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: 'siteUrl' } })
    const m = setting?.value ? String(setting.value).match(/https?:\/\/[^"'\s]+/i) : null
    if (m) selfHost = new URL(m[0]).hostname
  } catch {
    selfHost = null
  }

  // 插入：派生列全部 NULL（模拟历史/未回填行）。时间戳取库里最新事件 +1h 起，
  // 递减 3h，确保种子排在访问记录页最前，便于看爬虫行标记。
  const latest = await prisma.analyticsEvent.aggregate({ _max: { createdAt: true } })
  const now = (latest._max.createdAt?.getTime() ?? Date.now()) + 60 * 60 * 1000
  await Promise.all(ROWS.map((_, i) => prisma.visitor.upsert({
    where: { visitorId: `seed-ua-${i}` },
    create: { visitorId: `seed-ua-${i}` },
    update: { lastSeenAt: new Date(now - i * 3 * 3600 * 1000), visitCount: { increment: 1 } },
  })))
  const created = await Promise.all(ROWS.map((r, i) => prisma.analyticsEvent.create({
    data: {
      path: PATH,
      contentType: 'page',
      visitorId: `seed-ua-${i}`,
      referrer: r.referrer,
      country: r.country,
      userAgent: r.ua,
      createdAt: new Date(now - i * 3 * 3600 * 1000),
    },
  })))

  // —— 懒回填（复用 parse.ts，与 service 中的 ensureXxxWarmed 同逻辑）——
  // isBot
  const uaRows = await prisma.analyticsEvent.findMany({ where: { isBot: null, userAgent: { not: null }, path: PATH }, select: { userAgent: true }, distinct: ['userAgent'] })
  for (const { userAgent } of uaRows) {
    await prisma.analyticsEvent.updateMany({ where: { isBot: null, userAgent, path: PATH }, data: { isBot: isCrawlerUa(userAgent) } })
  }
  await prisma.analyticsEvent.updateMany({ where: { isBot: null, userAgent: null, path: PATH }, data: { isBot: false } })
  // os/browser
  const uaRows2 = await prisma.analyticsEvent.findMany({ where: { userAgent: { not: null }, path: PATH, OR: [{ operatingSystem: null }, { browser: null }] }, select: { userAgent: true }, distinct: ['userAgent'] })
  for (const { userAgent } of uaRows2) {
    await prisma.analyticsEvent.updateMany({ where: { userAgent, path: PATH, OR: [{ operatingSystem: null }, { browser: null }] }, data: { operatingSystem: parseOperatingSystem(userAgent), browser: parseBrowser(userAgent) } })
  }
  // referrerDomain
  const refRows = await prisma.analyticsEvent.findMany({ where: { referrer: { not: '' }, referrerDomain: null, path: PATH }, select: { referrer: true }, distinct: ['referrer'] })
  for (const { referrer } of refRows) {
    await prisma.analyticsEvent.updateMany({ where: { referrer, referrerDomain: null, path: PATH }, data: { referrerDomain: extractReferrerDomain(referrer, selfHost) } })
  }

  // —— 校验落库结果 ——
  const stored = await prisma.analyticsEvent.findMany({ where: { path: PATH }, orderBy: { createdAt: 'desc' } })
  let fail = 0
  console.log(`插入 ${created.length} 行，回填后校验：`)
  for (let i = 0; i < ROWS.length; i++) {
    const r = ROWS[i]
    const s = stored.find((x) => x.userAgent === r.ua)
    if (!s) continue
    const ok = s.browser === r.expectBrowser && s.operatingSystem === r.expectOs && s.isBot === r.expectIsBot && s.referrerDomain === r.expectDomain
    if (!ok) fail++
    console.log(`[${ok ? 'OK ' : 'XX '}] browser=${(s.browser ?? '?').padEnd(8)} os=${(s.operatingSystem ?? '?').padEnd(8)} isBot=${String(s.isBot).padEnd(5)} domain=${(s.referrerDomain ?? '∅').padEnd(16)} | expect ${r.expectBrowser}/${r.expectOs}/${r.expectIsBot}/${r.expectDomain ?? '∅'}`)
    if (!ok) console.log(`         UA: ${trunc(r.ua)}`)
  }
  console.log(`\n校验失败行数：${fail}/${ROWS.length}`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
