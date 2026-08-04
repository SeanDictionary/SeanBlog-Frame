'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'

type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
type BulkAction = 'publish' | 'draft' | 'archive' | 'delete'

type ArticleRow = {
  id: string
  title: string
  slug: string
  status: ArticleStatus
  isPinned: boolean
  publishedAt: string | null
  expiresAt: string | null
  viewCount: number
  visitorCount: number
  updatedAt: string
  category: { id: string; name: string; slug: string } | null
  tags: Array<{ id: string; name: string; slug: string }>
}

type Option = {
  id: string
  name: string
  slug: string
}

type ArticleManagementTableProps = {
  articles: ArticleRow[]
  categories: Option[]
  tags: Option[]
  total: number
  filters: {
    status?: string
    category?: string
    tag?: string
    q?: string
    sort: string
    order: string
  }
  exportHref: string
}

const statusLabels: Record<ArticleStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  ARCHIVED: '已归档',
}

const statusStyles = {
  DRAFT: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  PUBLISHED: 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300',
  ARCHIVED: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
} satisfies Record<ArticleStatus, string>

function formatDate(value: string | null) {
  if (!value) return '未设置'
  return new Date(value).toLocaleDateString('zh-CN')
}

function statusBadges(article: ArticleRow) {
  const now = Date.now()
  const badges: Array<{ label: string; className: string }> = [
    { label: statusLabels[article.status], className: statusStyles[article.status] },
  ]
  const publishedAt = article.publishedAt ? new Date(article.publishedAt).getTime() : null
  const expiresAt = article.expiresAt ? new Date(article.expiresAt).getTime() : null

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

  return badges
}

export function ArticleManagementTable({ articles, categories, tags, total, filters, exportHref }: ArticleManagementTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const allSelected = articles.length > 0 && selectedIds.size === articles.length

  const selectedCount = selectedIds.size
  const selectedIdList = useMemo(() => [...selectedIds], [selectedIds])

  function toggleArticle(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(articles.map((article) => article.id)))
  }

  function runBulkAction(action: BulkAction) {
    if (!selectedCount) {
      setMessage('请先选择文章。')
      return
    }

    if (action === 'delete' && !window.confirm(`确认删除选中的 ${selectedCount} 篇文章吗？此操作不可撤销。`)) {
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/articles/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIdList, action }),
        })
        const data = (await response.json()) as { count?: number; error?: { message?: string } }

        if (!response.ok) {
          throw new Error(data.error?.message ?? '批量操作失败。')
        }

        window.location.assign(`/admin/articles?bulk=${data.count ?? selectedCount}`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '批量操作失败。')
      }
    })
  }

  function importArticles(file: File) {
    startTransition(async () => {
      try {
        const text = await file.text()
        const payload = JSON.parse(text) as unknown
        const response = await fetch('/api/admin/articles/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = (await response.json()) as { count?: number; error?: { message?: string } }

        if (!response.ok) {
          throw new Error(data.error?.message ?? '导入失败。')
        }

        window.location.assign(`/admin/articles?imported=${data.count ?? 0}`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '导入失败，请确认 JSON 文件格式正确。')
      } finally {
        if (importInputRef.current) importInputRef.current.value = ''
      }
    })
  }

  return (
    <div className="space-y-5">
      <form className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950 md:grid-cols-6" action="/admin/articles">
        <input name="q" defaultValue={filters.q ?? ''} placeholder="搜索标题、摘要、正文" className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 md:col-span-2" />
        <select name="status" defaultValue={filters.status ?? ''} className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">全部状态</option>
          <option value="DRAFT">草稿</option>
          <option value="PUBLISHED">已发布</option>
          <option value="ARCHIVED">已归档</option>
        </select>
        <select name="category" defaultValue={filters.category ?? ''} className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">全部分类</option>
          {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
        </select>
        <select name="tag" defaultValue={filters.tag ?? ''} className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">全部标签</option>
          {tags.map((tag) => <option key={tag.id} value={tag.slug}>{tag.name}</option>)}
        </select>
        <div className="flex gap-2">
          <select name="sort" defaultValue={filters.sort} className="h-10 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900">
            <option value="updatedAt">更新时间</option>
            <option value="publishedAt">发布时间</option>
            <option value="createdAt">创建时间</option>
            <option value="viewCount">浏览量</option>
            <option value="visitorCount">浏览人数</option>
            <option value="title">标题</option>
          </select>
          <select name="order" defaultValue={filters.order} aria-label="排序方向" className="h-10 rounded-md border border-neutral-300 bg-white px-2 outline-none dark:border-neutral-700 dark:bg-neutral-900">
            <option value="desc">降序</option>
            <option value="asc">升序</option>
          </select>
        </div>
        <div className="flex gap-2 md:col-span-6">
          <button type="submit" className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950">应用筛选</button>
          <Link href="/admin/articles" className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">清空</Link>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <p className="text-sm text-neutral-500">共 {total} 篇，已选择 {selectedCount} 篇。</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={isPending || !selectedCount} onClick={() => runBulkAction('publish')} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700">批量发布</button>
          <button type="button" disabled={isPending || !selectedCount} onClick={() => runBulkAction('draft')} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700">设为草稿</button>
          <button type="button" disabled={isPending || !selectedCount} onClick={() => runBulkAction('archive')} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700">批量归档</button>
          <button type="button" disabled={isPending || !selectedCount} onClick={() => runBulkAction('delete')} className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50 dark:border-red-900/70">批量删除</button>
          <a href={exportHref} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">导出 JSON</a>
          <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
            导入 JSON
            <input ref={importInputRef} type="file" accept="application/json,.json" className="sr-only" onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) importArticles(file)
            }} />
          </label>
        </div>
      </div>
      {message && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300" role="alert">{message}</p>}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        {articles.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="选择全部文章" /></th>
                <th className="px-4 py-3 font-medium">标题 / Slug</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">分类 / 标签</th>
                <th className="px-4 py-3 font-medium">浏览量</th>
                <th className="px-4 py-3 font-medium">浏览人数</th>
                <th className="px-4 py-3 font-medium">发布时间</th>
                <th className="px-4 py-3 font-medium">更新于</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {articles.map((article) => (
                <tr key={article.id}>
                  <td className="px-4 py-4 align-top"><input type="checkbox" checked={selectedIds.has(article.id)} onChange={() => toggleArticle(article.id)} aria-label={`选择 ${article.title}`} /></td>
                  <td className="px-4 py-4 align-top">
                    <Link href={`/admin/articles/${article.id}/edit`} className="font-medium transition-colors hover:text-blue-600 dark:hover:text-blue-300">{article.title}</Link>
                    <p className="mt-1 flex items-center gap-2 font-mono text-xs text-neutral-500">
                      /{article.slug}
                      <a href={`/articles/${article.slug}`} target="_blank" rel="noreferrer" className="text-neutral-400 transition-colors hover:text-neutral-950 dark:hover:text-neutral-50" aria-label="在新窗口打开文章">
                        <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                      </a>
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top"><div className="flex flex-wrap gap-1.5">{statusBadges(article).map((badge) => <span key={badge.label} className={`rounded-full px-2 py-1 text-xs ${badge.className}`}>{badge.label}</span>)}</div></td>
                  <td className="px-4 py-4 align-top text-neutral-500">
                    <p>{article.category?.name ?? '未分类'}</p>
                    {article.tags.length > 0 && <p className="mt-1 text-xs">{article.tags.map((tag) => tag.name).join(' / ')}</p>}
                  </td>
                  <td className="px-4 py-4 align-top text-neutral-500">{article.viewCount}</td>
                  <td className="px-4 py-4 align-top text-neutral-500">{article.visitorCount}</td>
                  <td className="px-4 py-4 align-top text-neutral-500">{formatDate(article.publishedAt)}</td>
                  <td className="px-4 py-4 align-top text-neutral-500">{formatDate(article.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-16 text-center text-sm text-neutral-500">当前筛选条件下没有文章。</div>
        )}
      </div>
    </div>
  )
}
