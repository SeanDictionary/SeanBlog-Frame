'use client'

import { useRef, useState, useTransition } from 'react'
import { useAdminToast } from '@/components/admin/admin-toast-provider'
import { Card } from '@/components/ui/card'

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
}

type MediaApiResponse = {
  media?: Media
  mediaItems?: Media[]
  count?: number
  error?: { message?: string }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getImageFiles(files: FileList | File[]) {
  return Array.from(files).filter((file) => file.type.startsWith('image/'))
}

export function MediaManager({ initialMedia }: MediaManagerProps) {
  const toast = useAdminToast()
  const [media, setMedia] = useState(initialMedia)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)
  const selectedCount = selectedIds.length
  const allSelected = media.length > 0 && selectedIds.length === media.length

  function addMedia(items: Media[]) {
    setMedia((previous) => [...items, ...previous.filter((existing) => !items.some((item) => item.id === existing.id))])
  }

  async function uploadImageFiles(files: File[]) {
    const images = getImageFiles(files)

    if (!images.length) {
      toast.info('未发现可上传的图片。')
      return
    }

    const formData = new FormData()
    for (const file of images) formData.append('file', file)

    const response = await fetch('/api/admin/media/upload', { method: 'POST', body: formData })
    const data = (await response.json()) as MediaApiResponse

    if (!response.ok || !data.mediaItems?.length) {
      throw new Error(data.error?.message ?? '上传失败。')
    }

    addMedia(data.mediaItems)
    toast.success(`已上传 ${data.mediaItems.length} 个媒体资源。`)
  }

  function upload(formData: FormData) {
    startTransition(async () => {
      try {
        const files = formData.getAll('file').filter((file): file is File => file instanceof File)
        await uploadImageFiles(files)
        const form = document.getElementById('media-upload-form')
        if (form instanceof HTMLFormElement) form.reset()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '上传失败。')
      }
    })
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const images = getImageFiles(event.clipboardData.files)
    if (!images.length) return

    event.preventDefault()
    startTransition(async () => {
      try {
        await uploadImageFiles(images)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '粘贴上传失败。')
      }
    })
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return
    event.preventDefault()
    dragCounter.current += 1
    setIsDragging(true)
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return
    event.preventDefault()
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragCounter.current = Math.max(0, dragCounter.current - 1)
    if (dragCounter.current === 0) setIsDragging(false)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return
    event.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)

    const files = Array.from(event.dataTransfer.files).filter((file): file is File => file instanceof File)
    startTransition(async () => {
      try {
        await uploadImageFiles(files)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '拖拽上传失败。')
      }
    })
  }

  function remove(id: string) {
    if (!window.confirm('确认删除这条媒体记录吗？将同时删除 uploads 下对应本地文件。')) return

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/media/${id}`, { method: 'DELETE' })
        if (!response.ok) throw new Error('删除失败。')
        setMedia((previous) => previous.filter((item) => item.id !== id))
        setSelectedIds((previous) => previous.filter((itemId) => itemId !== id))
        toast.success('已删除 1 个媒体资源。')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '删除失败。')
      }
    })
  }

  function removeSelected() {
    if (!selectedIds.length) return
    if (!window.confirm(`确认删除选中的 ${selectedIds.length} 个媒体资源吗？将同步删除对应的本地文件。`)) return

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
          <p className="mt-1 text-sm text-neutral-500">可以拖拽或复制粘贴以上传文件。文件名保留原文件名，冲突时自动追加序号。</p>
        </div>
        <form id="media-upload-form" action={upload} className="flex flex-wrap items-center gap-3">
          <input name="file" type="file" accept="image/*" multiple className="max-w-72 text-sm" />
          <button disabled={isPending} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">上传图片</button>
        </form>
      </div>
    </Card>

    <Card padding="md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">媒体库</h2><p className="mt-1 text-sm text-neutral-500">选中多个资源后可批量删除。</p></div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={allSelected} onChange={(event) => setSelectedIds(event.target.checked ? media.map((item) => item.id) : [])} /> 全选</label>
          <button type="button" disabled={isPending || selectedCount === 0} onClick={removeSelected} className="rounded-md border border-red-200 px-3 py-1.5 text-red-600 disabled:opacity-50 dark:border-red-900/60">批量删除{selectedCount ? `（${selectedCount}）` : ''}</button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{media.map((item) => <article key={item.id} className={`overflow-hidden rounded-lg border bg-white dark:bg-neutral-950 ${selectedIds.includes(item.id) ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-950' : 'border-neutral-200 dark:border-neutral-800'}`}><div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 text-sm dark:border-neutral-900"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} /> 选择</label><button type="button" disabled={isPending} onClick={() => remove(item.id)} className="text-red-600 disabled:opacity-50">删除</button></div><a href={item.url} target="_blank" rel="noreferrer" className="grid aspect-video place-items-center bg-neutral-100 dark:bg-neutral-900">{item.mimeType.startsWith('image/') ? <img src={item.url} alt={item.filename} className="size-full object-cover" /> : <i className="fa-regular fa-file text-2xl text-neutral-400" />}</a><div className="p-4"><p className="truncate font-medium">{item.filename}</p><p className="mt-1 truncate font-mono text-xs text-neutral-500">{item.key}</p><p className="mt-1 text-xs text-neutral-500">{item.mimeType} · {formatSize(item.size)}</p></div></article>)}</div>
      {media.length === 0 && <div className="rounded-lg border border-dashed border-neutral-300 px-5 py-16 text-center text-sm text-neutral-500 dark:border-neutral-700">还没有上传媒体资源。</div>}
    </Card>

    {isDragging && (
      <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-blue-50/80 dark:bg-blue-950/60">
        <div className="rounded-xl border-2 border-dashed border-blue-400 bg-white px-10 py-8 text-center text-blue-600 shadow-lg dark:bg-neutral-900 dark:text-blue-300">
          <i className="fa-solid fa-cloud-arrow-up text-3xl" aria-hidden="true" />
          <p className="mt-2 font-medium">松开鼠标以上传图片</p>
        </div>
      </div>
    )}
  </div>
}
