import type { MetadataRoute } from 'next'

import { getSiteUrl } from '@/lib/services/setting-service'

// 站点 URL 来自后台设置（DB），需按请求动态生成，不能在构建期静态固化。
export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await getSiteUrl()

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/admin/',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
