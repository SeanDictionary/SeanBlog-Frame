import Link from 'next/link'

import { listAdminArticles } from '@/lib/services/article-service'

export default async function AdminArticlesPage() {
  const result = await listAdminArticles({ page: 1, pageSize: 50 })

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

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        {result.items.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
              <tr>
                <th className="px-5 py-3 font-medium">标题</th>
                <th className="px-5 py-3 font-medium">状态</th>
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
                  <td className="px-5 py-4"><StatusBadge status={article.status} /></td>
                  <td className="px-5 py-4 text-neutral-500">{article.updatedAt.toLocaleDateString('zh-CN')}</td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/admin/articles/${article.id}/edit`} className="text-neutral-500 transition-colors hover:text-neutral-950 dark:hover:text-neutral-50">编辑</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-16 text-center text-sm text-neutral-500">还没有文章，创建第一篇开始写作。</div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }) {
  const labels = { DRAFT: '草稿', PUBLISHED: '已发布', ARCHIVED: '已归档' }
  const styles = {
    DRAFT: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    PUBLISHED: 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300',
    ARCHIVED: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
  }

  return <span className={`rounded-full px-2 py-1 text-xs ${styles[status]}`}>{labels[status]}</span>
}
