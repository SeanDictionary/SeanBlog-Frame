import { ArticleStatus } from '@prisma/client'
import type { Route } from 'next'
import Link from 'next/link'

import { listAdminArticles } from '@/lib/services/article-service'

const articleStatusLabels = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  ARCHIVED: '已归档',
} satisfies Record<ArticleStatus, string>

function getSelectedStatus(status: string | undefined) {
  return status && status in articleStatusLabels ? status as ArticleStatus : undefined
}

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; saved?: string }>
}) {
  const { status: statusParam, saved } = await searchParams
  const status = getSelectedStatus(statusParam)
  const result = await listAdminArticles({ page: 1, pageSize: 50, status })
  const resultDescription = status ? `当前仅显示${articleStatusLabels[status]}文章` : '当前显示全部文章'

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-neutral-500">内容管理</p>
          <h1 className="text-3xl font-semibold tracking-tight">文章</h1>
        </div>
        <Link href="/admin/articles/new" className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950">
          <i className="fa-solid fa-plus mr-2 text-xs" aria-hidden="true" />
          新建文章
        </Link>
      </header>

      {saved === '1' && (
        <p className="mb-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300" role="status">
          文章已保存。
        </p>
      )}

      <nav className="mb-5 flex flex-wrap items-center gap-2" aria-label="文章状态筛选">
        <FilterLink href="/admin/articles" active={!status}>全部</FilterLink>
        {(Object.entries(articleStatusLabels) as Array<[ArticleStatus, string]>).map(([value, label]) => (
          <FilterLink key={value} href={`/admin/articles?status=${value}`} active={status === value}>{label}</FilterLink>
        ))}
      </nav>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <p className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">{resultDescription}，共 {result.meta.total} 篇。</p>
        {result.items.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
              <tr>
                <th className="px-5 py-3 font-medium">标题</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">发布时间</th>
                <th className="px-5 py-3 font-medium">更新于</th>
                <th className="px-5 py-3" aria-label="操作" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {result.items.map((article) => (
                <tr key={article.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium">{article.title}</p>
                    <p className="mt-1 font-mono text-xs text-neutral-500">/{article.slug}</p>
                  </td>
                  <td className="px-5 py-4"><StatusBadges article={article} /></td>
                  <td className="px-5 py-4 text-neutral-500">{article.publishedAt ? article.publishedAt.toLocaleDateString('zh-CN') : '未设置'}</td>
                  <td className="px-5 py-4 text-neutral-500">{article.updatedAt.toLocaleDateString('zh-CN')}</td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/admin/articles/${article.id}/edit`} className="text-neutral-500 transition-colors hover:text-neutral-950 dark:hover:text-neutral-50">编辑</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-16 text-center text-sm text-neutral-500">
            {status ? `当前没有${articleStatusLabels[status]}文章。` : '还没有文章，创建第一篇开始写作。'}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterLink({ href, active, children }: { href: Route; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950'
          : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
      }`}
    >
      {children}
    </Link>
  )
}

type AdminArticleListItem = Awaited<ReturnType<typeof listAdminArticles>>['items'][number]

function StatusBadges({ article }: { article: AdminArticleListItem }) {
  const now = Date.now()
  const badges: Array<{ label: string; className: string }> = [
    { label: articleStatusLabels[article.status], className: statusStyles[article.status] },
  ]
  const publishedAt = article.publishedAt?.getTime() ?? null
  const expiresAt = article.expiresAt?.getTime() ?? null

  if (article.isPinned) {
    badges.push({ label: '置顶', className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' })
  }

  if (article.status === 'PUBLISHED' && publishedAt && publishedAt > now) {
    badges.push({ label: '待发布', className: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300' })
  }

  if (expiresAt && expiresAt <= now) {
    badges.push({ label: '已过期', className: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300' })
  } else if (expiresAt) {
    badges.push({ label: '定时过期', className: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300' })
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => <span key={badge.label} className={`rounded-full px-2 py-1 text-xs ${badge.className}`}>{badge.label}</span>)}
    </div>
  )
}

const statusStyles = {
  DRAFT: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  PUBLISHED: 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300',
  ARCHIVED: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
} satisfies Record<ArticleStatus, string>
