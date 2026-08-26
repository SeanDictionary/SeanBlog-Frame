'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { useAdminToast, type AdminToastLevel } from '@/components/admin/admin-toast-provider'
import { Card } from '@/components/ui/card'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { formatDateCompact } from '@/lib/format'

type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
type BulkAction = 'publish' | 'draft' | 'archive' | 'delete'
type SortField = 'updatedAt' | 'publishedAt' | 'createdAt' | 'viewCount' | 'visitorCount' | 'title'

type ArticleRow = {
  id: string
  title: string
  slug: string
  status: ArticleStatus
  isPinned: boolean
  publishedAt: string | null
  viewCount: number
  visitorCount: number
  updatedAt: string
  category: { id: string; name: string; slug: string } | null
  tags: Array<{ id: string; name: string; slug: string }>
}

type ArticleManagementTableProps = {
  articles: ArticleRow[]
  total: number
  filters: {
    status?: string
    category?: string
    tag?: string
    q?: string
    sort: string
    order: string
  }
  initialNotice?: string | null
}

const statusLabels: Record<ArticleStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  ARCHIVED: '已归档',
}

const statusTone: Record<ArticleStatus, BadgeTone> = {
  DRAFT: 'amber',
  PUBLISHED: 'green',
  ARCHIVED: 'neutral',
}

const defaultSortOrder: Record<SortField, 'asc' | 'desc'> = {
  title: 'asc',
  updatedAt: 'desc',
  publishedAt: 'desc',
  createdAt: 'desc',
  viewCount: 'desc',
  visitorCount: 'desc',
}

function statusBadges(article: ArticleRow) {
  const now = Date.now()
  const badges: Array<{ label: string; tone: BadgeTone }> = [
    { label: statusLabels[article.status], tone: statusTone[article.status] },
  ]
  const publishedAt = article.publishedAt ? new Date(article.publishedAt).getTime() : null

  if (article.isPinned) {
    badges.push({ label: '置顶', tone: 'blue' })
  }

  if (article.status === 'PUBLISHED' && publishedAt && publishedAt > now) {
    badges.push({ label: '待发布', tone: 'purple' })
  }

  return badges
}

function getDispositionFilename(disposition: string | null, fallback: string) {
  const match = disposition?.match(/filename="?([^";]+)"?/i)
  return match?.[1] ? decodeURIComponent(match[1]) : fallback
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function createQueryString(filters: ArticleManagementTableProps['filters'], overrides: Record<string, string | null>) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value)
    else params.delete(key)
  }

  return params.toString()
}

function TaxonomyLink({ type, slug, label }: { type: 'category' | 'tag'; slug: string; label: string }) {
  const params = new URLSearchParams({ q: label, [type]: slug })

  return (
    <Link
      href={(`/admin/articles?${params.toString()}`) as Route}
      className="transition-colors hover:text-blue-600 hover:underline dark:hover:text-blue-300"
    >
      {label}
    </Link>
  )
}

function SortHeader({ field, label, filters }: { field: SortField; label: string; filters: ArticleManagementTableProps['filters'] }) {
  const active = filters.sort === field
  const currentOrder = filters.order === 'asc' ? 'asc' : 'desc'
  const nextOrder = active ? (currentOrder === 'asc' ? 'desc' : 'asc') : defaultSortOrder[field]
  const href = (`/admin/articles?${createQueryString(filters, { sort: field, order: nextOrder })}`) as Route

  return (
    <Link href={href} className="group inline-flex items-center gap-1.5 transition-colors hover:text-neutral-950 dark:hover:text-neutral-50">
      {label}
      <span className={`text-[10px] ${active ? 'text-blue-600 dark:text-blue-300' : 'text-neutral-300 group-hover:text-neutral-500 dark:text-neutral-700'}`} aria-hidden="true">
        {active ? (currentOrder === 'asc' ? '▲' : '▼') : '↕'}
      </span>
      <span className="sr-only">{active ? `当前${currentOrder === 'asc' ? '升序' : '降序'}，点击切换排序` : '点击排序'}</span>
    </Link>
  )
}

function resolveNoticeLevel(message: string): AdminToastLevel {
  if (message.includes('失败') || message.includes('错误') || message.includes('请先')) return 'error'
  if (message.includes('已') || message.includes('成功')) return 'success'
  return 'info'
}

export function ArticleManagementTable({ articles, total, filters, initialNotice }: ArticleManagementTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const toast = useAdminToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchText, setSearchText] = useState(filters.q ?? '')
  const [isPending, startTransition] = useTransition()
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const lastAppliedSearchRef = useRef(filters.q ?? '')
  const visibleIds = useMemo(() => articles.map((article) => article.id), [articles])
  const visibleSelectedCount = visibleIds.filter((id) => selectedIds.has(id)).length
  const allSelected = articles.length > 0 && visibleSelectedCount === articles.length
  const selectedCount = selectedIds.size
  const selectedIdList = useMemo(() => [...selectedIds], [selectedIds])

  useEffect(() => {
    if (initialNotice) toast.notify(initialNotice, resolveNoticeLevel(initialNotice))
  }, [initialNotice, toast])

  useEffect(() => {
    setSearchText(filters.q ?? '')
    lastAppliedSearchRef.current = filters.q ?? ''
  }, [filters.q])

  useEffect(() => {
    const trimmedSearch = searchText.trim()

    if (trimmedSearch === lastAppliedSearchRef.current) return

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())

      if (trimmedSearch) params.set('q', trimmedSearch)
      else params.delete('q')

      params.delete('category')
      params.delete('tag')
      params.delete('status')
      params.delete('page')
      const queryString = params.toString()
      const nextHref = (queryString ? `${pathname}?${queryString}` : pathname) as Route
      lastAppliedSearchRef.current = trimmedSearch
      router.replace(nextHref, { scroll: false })
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [pathname, router, searchParams, searchText])

  function clearSearch() {
    const params = new URLSearchParams(searchParams.toString())

    params.delete('q')
    params.delete('category')
    params.delete('tag')
    params.delete('status')
    params.delete('page')
    const queryString = params.toString()
    const nextHref = (queryString ? `${pathname}?${queryString}` : pathname) as Route

    lastAppliedSearchRef.current = ''
    setSearchText('')
    router.replace(nextHref, { scroll: false })
  }

  function toggleArticle(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((previous) => {
      const next = new Set(previous)

      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }

      return next
    })
  }

  const bulkActionLabels: Record<BulkAction, string> = {
    publish: '发布',
    draft: '设为草稿',
    archive: '归档',
    delete: '删除',
  }

  function runBulkAction(action: BulkAction) {
    if (!selectedCount) {
      toast.error('请先选择文章。')
      return
    }

    if (action === 'delete' && !window.confirm(`确认删除选中的 ${selectedCount} 篇文章吗？此操作不可撤销。`)) {
      return
    }

    const verb = bulkActionLabels[action]

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

        const count = data.count ?? selectedCount
        if (count === 0) {
          toast.info(`批量${verb}未匹配到任何文章。`)
        } else {
          toast.success(`已批量${verb} ${count} 篇文章。`)
        }
        setSelectedIds(new Set())
        router.refresh()
      } catch (error) {
        toast.error(`批量${verb}时遇到错误：${error instanceof Error ? error.message : '批量操作失败。'}`)
      }
    })
  }

  function exportSelectedArticles() {
    if (!selectedCount) {
      toast.error('请先选择要导出的文章。')
      return
    }

    startTransition(async () => {
      try {
        const params = new URLSearchParams()
        selectedIdList.forEach((id) => params.append('id', id))
        const response = await fetch(`/api/admin/articles/export?${params.toString()}`)

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
          throw new Error(data?.error?.message ?? '导出失败。')
        }

        downloadBlob(await response.blob(), getDispositionFilename(response.headers.get('Content-Disposition'), selectedCount === 1 ? 'article.zip' : 'articles.zip'))
        toast.success(`已导出 ${selectedCount} 篇文章。`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '导出失败。')
      }
    })
  }

  function importArticles(file: File) {
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const response = await fetch('/api/admin/articles/import', { method: 'POST', body: formData })
        const data = (await response.json()) as { count?: number; articles?: Array<{ title: string; slug: string }>; error?: { message?: string } }

        if (!response.ok) {
          throw new Error(data.error?.message ?? '导入失败。')
        }

        const importedNames = data.articles?.map((article) => article.title || article.slug).join('、')
        toast.success(importedNames ? `导入成功：${importedNames}` : `已导入 ${data.count ?? 0} 篇文章。`)
        setSelectedIds(new Set())
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '导入失败，请确认 ZIP 文件结构正确。')
      } finally {
        if (importInputRef.current) importInputRef.current.value = ''
      }
    })
  }

  return (
    <div className="space-y-5">
      <Card padding="sm" rounded="2xl" shadow>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative block md:w-96">
              <span className="sr-only">实时搜索文章</span>
              <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400" aria-hidden="true" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜索标题、正文、标签或分类"
                className="h-10 w-full rounded-xl border border-neutral-300 bg-white pl-9 pr-9 text-sm outline-none transition-colors focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
                  aria-label="清除搜索"
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              )}
            </label>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
              <span>已选 {selectedCount}</span>
              <span className="hidden text-neutral-300 dark:text-neutral-700 sm:inline">/</span>
              <span>{total} 篇</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={isPending || !selectedCount} onClick={() => runBulkAction('publish')} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700">批量发布</button>
            <button type="button" disabled={isPending || !selectedCount} onClick={() => runBulkAction('draft')} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700">设为草稿</button>
            <button type="button" disabled={isPending || !selectedCount} onClick={() => runBulkAction('archive')} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700">批量归档</button>
            <button type="button" disabled={isPending || !selectedCount} onClick={() => runBulkAction('delete')} className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50 dark:border-red-900/70">批量删除</button>
            <button type="button" disabled={isPending || !selectedCount} onClick={exportSelectedArticles} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700">导出 ZIP</button>
            <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
              导入 ZIP
              <input ref={importInputRef} type="file" accept="application/zip,.zip" className="sr-only" onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                if (file) importArticles(file)
              }} />
            </label>
          </div>
        </div>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        {articles.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-245 text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="选择当前页全部文章" /></th>
                  <th className="px-4 py-3 font-medium"><SortHeader field="title" label="标题 / Slug" filters={filters} /></th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">分类 / 标签</th>
                  <th className="px-4 py-3 font-medium"><SortHeader field="viewCount" label="浏览量" filters={filters} /></th>
                  <th className="px-4 py-3 font-medium"><SortHeader field="visitorCount" label="浏览人数" filters={filters} /></th>
                  <th className="px-4 py-3 font-medium"><SortHeader field="publishedAt" label="发布时间" filters={filters} /></th>
                  <th className="px-4 py-3 font-medium"><SortHeader field="updatedAt" label="更新于" filters={filters} /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                {articles.map((article) => (
                  <tr
                    key={article.id}
                    className={`cursor-pointer transition-colors ${selectedIds.has(article.id) ? 'bg-blue-50/70 dark:bg-blue-950/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60'}`}
                    onClick={() => toggleArticle(article.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        toggleArticle(article.id)
                      }
                    }}
                    tabIndex={0}
                  >
                    <td className="px-4 py-4 align-top"><input type="checkbox" checked={selectedIds.has(article.id)} onChange={() => toggleArticle(article.id)} aria-label={`选择 ${article.title}`} onClick={(event) => event.stopPropagation()} /></td>
                    <td className="px-4 py-4 align-top" onClick={(event) => event.stopPropagation()}>
                      <Link href={`/admin/articles/${article.id}/edit`} className="font-medium">{article.title}</Link>
                      <p className="mt-1 flex items-center gap-2 font-mono text-xs text-neutral-500">
                        /{article.slug}
                        <a href={`/articles/${article.slug}`} target="_blank" rel="noreferrer" className="text-neutral-400 transition-colors hover:text-neutral-950 dark:hover:text-neutral-50" aria-label="在新窗口打开文章">
                          <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                        </a>
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top"><div className="flex flex-wrap gap-1.5">{statusBadges(article).map((badge) => <Badge key={badge.label} tone={badge.tone}>{badge.label}</Badge>)}</div></td>
                    <td className="px-4 py-4 align-top" onClick={(event) => event.stopPropagation()}>
                      <div className="max-w-56 space-y-1 text-neutral-500">
                        <p>
                          {article.category ? <TaxonomyLink type="category" slug={article.category.slug} label={article.category.name} /> : <span>未分类</span>}
                        </p>
                        <p className="text-xs">
                          {article.tags.length > 0
                            ? article.tags.map((tag, index) => (
                                <span key={tag.id}>
                                  {index === 0 && <span className="text-neutral-300 dark:text-neutral-600"># </span>}
                                  {index > 0 && <span className="mx-1 text-neutral-300 dark:text-neutral-700">/</span>}
                                  <TaxonomyLink type="tag" slug={tag.slug} label={tag.name} />
                                </span>
                              ))
                            : <span>无标签</span>}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-neutral-500">{article.viewCount}</td>
                    <td className="px-4 py-4 align-top text-neutral-500">{article.visitorCount}</td>
                    <td className="px-4 py-4 align-top text-neutral-500">{formatDateCompact(article.publishedAt)}</td>
                    <td className="px-4 py-4 align-top text-neutral-500">{formatDateCompact(article.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-16 text-center text-sm text-neutral-500">当前搜索条件下没有文章。</div>
        )}
      </div>
    </div>
  )
}
