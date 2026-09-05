'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { useAdminToast } from '@/components/admin/admin-toast-provider'
import { Card, CardHeader } from '@/components/ui/card'
import { MEDIA_CATEGORIES, categoryOf } from '@/lib/media-category'
import type { MediaCategory } from '@/lib/media-category'

type Media = {
  id: string
  filename: string
  url: string
  key: string
  size: number
  mimeType: string
  width: number | null
  height: number | null
  createdAt: Date
}

type MediaManagerProps = {
  initialMedia: Media[]
  meta: { total: number; page: number; pageSize: number; pageCount: number }
  filters: { q: string; page: number; pageSize: number }
}

type MediaApiResponse = {
  media?: Media
  mediaItems?: Media[]
  count?: number
  error?: { message?: string }
}

const PAGE_SIZE_OPTIONS = [20, 50, 100]

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toFiles(list: FileList | File[]) {
  return Array.from(list).filter((file): file is File => file instanceof File)
}

// Mirrors the page-number layout used by /admin/visits: 1 … n with ellipses.
function getPageItems(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const items: Array<number | 'ellipsis'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push('ellipsis')
  for (let page = start; page <= end; page += 1) items.push(page)
  if (end < total - 1) items.push('ellipsis')
  items.push(total)
  return items
}

export function MediaManager({ initialMedia, meta, filters }: MediaManagerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const toast = useAdminToast()
  const [media, setMedia] = useState(initialMedia)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filter, setFilter] = useState<MediaCategory | 'all'>('all')
  const [searchText, setSearchText] = useState(filters.q)
  const [isPending, startTransition] = useTransition()
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)
  const lastAppliedSearchRef = useRef(filters.q)
  const selectedCount = selectedIds.length

  const page = meta.page
  const pageCount = Math.max(1, meta.pageCount)
  const pageItems = getPageItems(page, pageCount)

  // Keep local list in sync with server-rendered page data on navigation/refresh.
  useEffect(() => {
    setMedia(initialMedia)
  }, [initialMedia])

  useEffect(() => {
    setSearchText(filters.q)
    lastAppliedSearchRef.current = filters.q
  }, [filters.q])

  // Debounced search → update ?q in URL, reset to page 1.
  useEffect(() => {
    const trimmedSearch = searchText.trim()

    if (trimmedSearch === lastAppliedSearchRef.current) return

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())

      if (trimmedSearch) params.set('q', trimmedSearch)
      else params.delete('q')

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
    params.delete('page')
    const queryString = params.toString()
    const nextHref = (queryString ? `${pathname}?${queryString}` : pathname) as Route

    lastAppliedSearchRef.current = ''
    setSearchText('')
    router.replace(nextHref, { scroll: false })
  }

  function changePageSize(size: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('pageSize', String(size))
    params.delete('page')
    router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false })
  }

  function hrefForPage(target: number): Route {
    const params = new URLSearchParams(searchParams.toString())
    if (target > 1) params.set('page', String(target))
    else params.delete('page')
    return `${pathname}?${params.toString()}` as Route
  }

  function refreshToPage(target: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (target > 1) params.set('page', String(target))
    else params.delete('page')
    router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false })
  }

  const categoryCounts = useMemo(() => {
    const counts = new Map<MediaCategory, number>()
    for (const item of media) {
      const key = categoryOf(item.mimeType).key
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [media])

  const visibleMedia = useMemo(
    () => (filter === 'all' ? media : media.filter((item) => categoryOf(item.mimeType).key === filter)),
    [media, filter],
  )
  const allSelected = visibleMedia.length > 0 && selectedIds.length === visibleMedia.length

  function addMedia(items: Media[]) {
    setMedia((previous) => [...items, ...previous.filter((existing) => !items.some((item) => item.id === existing.id))])
  }

  async function uploadFiles(files: File[]) {
    const filesToUpload = toFiles(files)

    if (!filesToUpload.length) {
      toast.info('未发现可上传的文件。')
      return
    }

    const formData = new FormData()
    for (const file of filesToUpload) formData.append('file', file)

    const response = await fetch('/api/admin/media/upload', { method: 'POST', body: formData })
    const data = (await response.json()) as MediaApiResponse

    if (!response.ok || !data.mediaItems?.length) {
      throw new Error(data.error?.message ?? '上传失败。')
    }

    toast.success(`已上传 ${data.mediaItems.length} 个文件。`)

    // Newly uploaded items are the newest (createdAt desc), so they appear at the
    // top of page 1. If the user is not on page 1, navigate there; otherwise refresh.
    if (filters.page === 1) {
      addMedia(data.mediaItems)
      router.refresh()
    } else {
      refreshToPage(1)
    }
  }

  function upload(formData: FormData) {
    startTransition(async () => {
      try {
        const files = formData.getAll('file').filter((file): file is File => file instanceof File)
        await uploadFiles(files)
        const form = document.getElementById('media-upload-form')
        if (form instanceof HTMLFormElement) form.reset()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '上传失败。')
      }
    })
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const files = toFiles(event.clipboardData.files)
    if (!files.length) return

    event.preventDefault()
    startTransition(async () => {
      try {
        await uploadFiles(files)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '粘贴上传失败。')
      }
    })
  }

  function hasFileTypes(dataTransfer: DataTransfer) {
    return Array.from(dataTransfer.types).includes('Files')
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (!hasFileTypes(event.dataTransfer)) return
    event.preventDefault()
    dragCounter.current += 1
    setIsDragging(true)
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!hasFileTypes(event.dataTransfer)) return
    event.preventDefault()
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragCounter.current = Math.max(0, dragCounter.current - 1)
    if (dragCounter.current === 0) setIsDragging(false)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!hasFileTypes(event.dataTransfer)) return
    event.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)

    const files = toFiles(event.dataTransfer.files)
    startTransition(async () => {
      try {
        await uploadFiles(files)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '拖拽上传失败。')
      }
    })
  }

  function remove(id: string) {
    if (!window.confirm('确认删除这条媒体记录吗？将同时删除 uploads 下对应本地文件。')) return

    const wasLastOnPage = media.length === 1
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/media/${id}`, { method: 'DELETE' })
        if (!response.ok) throw new Error('删除失败。')
        setMedia((previous) => previous.filter((item) => item.id !== id))
        setSelectedIds((previous) => previous.filter((itemId) => itemId !== id))
        toast.success('已删除 1 个媒体资源。')
        // If we just removed the only item on a non-first page, step back one page.
        if (wasLastOnPage && filters.page > 1) {
          refreshToPage(filters.page - 1)
        } else {
          router.refresh()
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '删除失败。')
      }
    })
  }

  function removeSelected() {
    if (!selectedIds.length) return
    if (!window.confirm(`确认删除选中的 ${selectedIds.length} 个媒体资源吗？将同步删除对应的本地文件。`)) return

    const removingAllVisible = selectedIds.length === media.length
    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/media/bulk', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds }),
        })
        const data = (await response.json()) as MediaApiResponse
        if (!response.ok) throw new Error(data.error?.message ?? '批量删除失败。')
        const deleted = data.count ?? selectedIds.length
        setMedia((previous) => previous.filter((item) => !selectedIds.includes(item.id)))
        setSelectedIds([])
        toast.success(`已批量删除 ${deleted} 个媒体资源。`)
        if (removingAllVisible && filters.page > 1) {
          refreshToPage(filters.page - 1)
        } else {
          router.refresh()
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '批量删除失败。')
      }
    })
  }

  function toggleSelected(id: string) {
    setSelectedIds((previous) => previous.includes(id) ? previous.filter((itemId) => itemId !== id) : [...previous, id])
  }

  return <div
    className="space-y-7"
    onPaste={handlePaste}
    onDragEnter={handleDragEnter}
    onDragOver={handleDragOver}
    onDragLeave={handleDragLeave}
    onDrop={handleDrop}
  >
    <Card padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-semibold">上传媒体资源</h2>
          <p className="mt-1 text-sm text-neutral-500">支持任意类型文件上传，可多选、复制粘贴或拖拽到本页面上传，按文件类型分类保存。文件名保留原文件名，冲突时自动追加序号。</p>
        </div>
        <form id="media-upload-form" action={upload} className="flex flex-wrap items-center self-center gap-3">
          <label className="grid gap-1.5 text-sm">选择文件<input name="file" type="file" multiple className="max-w-72 text-sm" /></label>
          <button disabled={isPending} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">上传文件</button>
        </form>
      </div>
    </Card>

    <Card padding="md">
      <CardHeader
        title="媒体库"
        description={`共 ${meta.total} 项，第 ${page} / ${pageCount} 页${filters.q ? `，搜索「${filters.q}」` : ''}`}
        action={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {pageCount > 1 && pageItems.map((item, index) =>
              item === 'ellipsis' ? (
                <span key={`e-${index}`} className="px-1 text-neutral-400">…</span>
              ) : item === page ? (
                <span key={item} aria-current="page" className="min-w-8 rounded-md border border-neutral-950 bg-neutral-950 px-2 py-1 text-center text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950">{item}</span>
              ) : (
                <Link key={item} href={hrefForPage(item)} className="min-w-8 rounded-md border border-neutral-300 px-2 py-1 text-center transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900">{item}</Link>
              ),
            )}
            <span className="ml-2 text-neutral-500">每页</span>
            <select
              value={filters.pageSize}
              onChange={(event) => changePageSize(Number(event.target.value))}
              className="h-8 rounded-md border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-900"
            >
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} 条</option>)}
            </select>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="relative block md:w-72">
          <span className="sr-only">搜索媒体资源</span>
          <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400" aria-hidden="true" />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="搜索文件名或路径"
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
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={allSelected} onChange={(event) => setSelectedIds(event.target.checked ? visibleMedia.map((item) => item.id) : [])} /> 全选</label>
          <button type="button" disabled={isPending || selectedCount === 0} onClick={removeSelected} className="rounded-md border border-red-200 px-3 py-1.5 text-red-600 disabled:opacity-50 dark:border-red-900/60">批量删除{selectedCount ? `（${selectedCount}）` : ''}</button>
        </div>
      </div>

      {categoryCounts.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <button type="button" onClick={() => setFilter('all')} className={`rounded-full border px-3 py-1 transition-colors ${filter === 'all' ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900' : 'border-neutral-300 text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400'}`}>全部</button>
          {MEDIA_CATEGORIES.filter((category) => categoryCounts.has(category.key)).map((category) => (
            <button key={category.key} type="button" onClick={() => setFilter(category.key)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors ${filter === category.key ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900' : 'border-neutral-300 text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400'}`}>
              <i className={category.icon} aria-hidden="true" />{category.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">{visibleMedia.map((item) => {
        const category = categoryOf(item.mimeType)
        return <article key={item.id} className={`overflow-hidden rounded-lg border bg-white dark:bg-neutral-950 ${selectedIds.includes(item.id) ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-950' : 'border-neutral-200 dark:border-neutral-800'}`}>
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 text-sm dark:border-neutral-900">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} /> 选择</label>
            <button type="button" disabled={isPending} onClick={() => remove(item.id)} className="text-red-600 disabled:opacity-50">删除</button>
          </div>
          <a href={item.url} target="_blank" rel="noreferrer" className="grid aspect-video place-items-center bg-neutral-100 dark:bg-neutral-900">
            {item.mimeType.startsWith('image/') ? <img src={item.url} alt={item.filename} className="size-full object-cover" /> : <i className={`${category.icon} text-3xl text-neutral-400`} aria-hidden="true" />}
          </a>
          <div className="p-4">
            <p className="truncate font-medium">{item.filename}</p>
            <p className="mt-1 truncate font-mono text-xs text-neutral-500">{item.key}</p>
            <p className="mt-1 text-xs text-neutral-500"><span className="inline-flex items-center gap-1"><i className={category.icon} aria-hidden="true" />{category.label}</span> · {item.mimeType} · {formatSize(item.size)}</p>
          </div>
        </article>
      })}</div>
      {meta.total === 0 && <div className="rounded-lg border border-dashed border-neutral-300 px-5 py-16 text-center text-sm text-neutral-500 dark:border-neutral-700">{filters.q ? '没有匹配的媒体资源。' : '还没有上传媒体资源。'}</div>}
      {meta.total > 0 && visibleMedia.length === 0 && <div className="rounded-lg border border-dashed border-neutral-300 px-5 py-16 text-center text-sm text-neutral-500 dark:border-neutral-700">当前分类下暂无资源。</div>}
    </Card>

    {isDragging && (
      <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-blue-50/80 dark:bg-blue-950/60">
        <div className="rounded-xl border-2 border-dashed border-blue-400 bg-white px-10 py-8 text-center text-blue-600 shadow-lg dark:bg-neutral-900 dark:text-blue-300">
          <i className="fa-solid fa-cloud-arrow-up text-3xl" aria-hidden="true" />
          <p className="mt-2 font-medium">松开鼠标以上传文件</p>
        </div>
      </div>
    )}
  </div>
}
