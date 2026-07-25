import type { MetadataRoute } from 'next'
import { ArticleStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

import { getPrisma } from '@/lib/prisma'
import { getSiteSettingsMap } from '@/lib/services/setting-service'

function normalizeBaseUrl(value: unknown) {
  const siteUrl = typeof value === 'string' && value.trim() ? value : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return siteUrl.replace(/\/$/, '')
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [settings, articles, categories, tags] = await Promise.all([
    getSiteSettingsMap(),
    getPrisma().article.findMany({
      where: {
        status: ArticleStatus.PUBLISHED,
        publishedAt: {
          not: null,
        },
      },
      orderBy: { publishedAt: 'desc' },
      select: {
        slug: true,
        updatedAt: true,
      },
    }),
    getPrisma().category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        slug: true,
        updatedAt: true,
      },
    }),
    getPrisma().tag.findMany({
      orderBy: { name: 'asc' },
      select: {
        slug: true,
        updatedAt: true,
      },
    }),
  ])

  const baseUrl = normalizeBaseUrl(settings.siteUrl)

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...articles.map((article) => ({
      url: `${baseUrl}/articles/${article.slug}`,
      lastModified: article.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...categories.map((category) => ({
      url: `${baseUrl}/categories/${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
    ...tags.map((tag) => ({
      url: `${baseUrl}/tags/${tag.slug}`,
      lastModified: tag.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ]
}
