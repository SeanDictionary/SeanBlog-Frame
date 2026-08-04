export const dynamic = 'force-dynamic'

import { getPublicArticleWhere } from '@/lib/services/article-visibility'
import { getPrisma } from '@/lib/prisma'
import { getSiteSettingsMap } from '@/lib/services/setting-service'

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export async function GET() {
  const [settings, articles] = await Promise.all([
    getSiteSettingsMap(),
    getPrisma().article.findMany({
      where: getPublicArticleWhere(),
      orderBy: { publishedAt: 'desc' },
      take: 50,
    }),
  ])

  const siteUrl = typeof settings.siteUrl === 'string' ? settings.siteUrl : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const siteName = typeof settings.siteName === 'string' ? settings.siteName : 'SeanBlog Frame'
  const siteDescription = typeof settings.siteDescription === 'string' ? settings.siteDescription : 'Personal blog feed'

  const items = articles
    .map((article) => {
      const url = `${siteUrl.replace(/\/$/, '')}/articles/${article.slug}`
      return `<item><title>${escapeXml(article.title)}</title><link>${escapeXml(url)}</link><guid>${escapeXml(url)}</guid><description>${escapeXml(article.excerpt ?? '')}</description><pubDate>${(article.publishedAt ?? article.createdAt).toUTCString()}</pubDate></item>`
    })
    .join('')

  const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(siteName)}</title><link>${escapeXml(siteUrl)}</link><description>${escapeXml(siteDescription)}</description>${items}</channel></rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  })
}
