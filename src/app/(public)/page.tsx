import type { Metadata } from 'next'
import Link from 'next/link'

import { listPublicArticles } from '@/lib/services/article-service'
import { getSiteSettingsMap } from '@/lib/services/setting-service'

export const metadata: Metadata = {
  title: '首页',
}

export default async function HomePage() {
  const [settings, result] = await Promise.all([
    getSiteSettingsMap(),
    listPublicArticles({ page: 1, pageSize: 10 }),
  ])

  const siteName = typeof settings.siteName === 'string' ? settings.siteName : 'SeanBlog'
  const siteDescription = typeof settings.siteDescription === 'string' ? settings.siteDescription : ''

  const pinned = result.items.filter((article) => article.isPinned)
  const latest = result.items.filter((article) => !article.isPinned)

  return (
    <div className="mx-auto max-w-[var(--content-max-width)] px-[var(--content-padding)] py-12">
      {/* Hero */}
      <section className="mb-16">
        <h1 className="text-3xl font-bold tracking-tight">{siteName}</h1>
        {siteDescription && (
          <p className="mt-2 text-text-secondary">{siteDescription}</p>
        )}
      </section>

      {/* Pinned articles */}
      {pinned.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-6 text-sm font-medium uppercase tracking-wider text-text-tertiary">
            置顶
          </h2>
          <div className="space-y-4">
            {pinned.map((article) => (
              <ArticleItem key={article.id} article={article} pinned />
            ))}
          </div>
        </section>
      )}

      {/* Latest articles */}
      <section>
        <h2 className="mb-6 text-sm font-medium uppercase tracking-wider text-text-tertiary">
          最新文章
        </h2>
        {latest.length > 0 ? (
          <div className="space-y-4">
            {latest.map((article) => (
              <ArticleItem key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <p className="text-text-tertiary">暂无文章。</p>
        )}
      </section>

      {/* Pagination hint */}
      {result.meta.pageCount > 1 && (
        <div className="mt-8 text-center text-sm text-text-tertiary">
          第 {result.meta.page} / {result.meta.pageCount} 页
        </div>
      )}
    </div>
  )
}

function ArticleItem({
  article,
  pinned = false,
}: {
  article: Awaited<ReturnType<typeof listPublicArticles>>['items'][number]
  pinned?: boolean
}) {
  return (
    <article className="group rounded-lg border border-border p-5 transition-colors hover:border-border-hover">
      <Link href={`/articles/${article.slug}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold leading-snug transition-colors group-hover:text-accent">
              {pinned && (
                <i className="fa-solid fa-thumbtack mr-2 text-xs text-accent" />
              )}
              {article.title}
            </h3>
            {article.excerpt && (
              <p className="mt-1.5 line-clamp-2 text-sm text-text-secondary">
                {article.excerpt}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-text-tertiary">
              {article.publishedAt && (
                <time dateTime={article.publishedAt.toISOString()}>
                  {article.publishedAt.toLocaleDateString('zh-CN')}
                </time>
              )}
              {article.category && (
                <span>{article.category.name}</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </article>
  )
}
