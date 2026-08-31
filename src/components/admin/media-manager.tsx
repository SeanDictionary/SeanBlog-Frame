'use client'

import { useState, useTransition } from 'react'
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
  const [media, setMedia] = useState(initialMedia)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const selectedCount = selectedIds.length
  const allSelected = media.length > 0 && selectedIds.length === media.length

  function addMedia(items: Media[]) {
    setMedia((previous) => [...items, ...previous.filter((existing) => !items.some((item) => item.id === existing.id))])
  }

  async function uploadImageFiles(files: File[]) {
    const images = getImageFiles(files)

    if (!images.length) {
      setMessage('未发现可上传的图片。')
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
    setMessage(`已上传 ${data.mediaItems.length} 个媒体资源。`)
  }

  function upload(formData: FormData) {
    startTransition(async () => {
      setMessage(null)
      try {
        const files = formData.getAll('file').filter((file): file is File => file instanceof File)
        await uploadImageFiles(files)
        const form = document.getElementById('media-upload-form')
        if (form instanceof HTMLFormElement) form.reset()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '上传失败。')
      }
    })
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const images = getImageFiles(event.clipboardData.files)
    if (!images.length) return

    event.preventDefault()
    startTransition(async () => {
      setMessage(null)
      try {
        await uploadImageFiles(images)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '粘贴上传失败。')
      }
    })
  }

  function remove(id: string) {
    if (!window.confirm('确认删除这条媒体记录吗？如果是本地上传文件，将同时删除 uploads 下对应文件。')) return

    startTransition(async () => {
      setMessage(null)
      try {
        const response = await fetch(`/api/admin/media/${id}`, { method: 'DELETE' })
        if (!response.ok) throw new Error('删除失败。')
        setMedia((previous) => previous.filter((item) => item.id !== id))
        setSelectedIds((previous) => previous.filter((itemId) => itemId !== id))
        setMessage('已删除 1 个媒体资源。')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '删除失败。')
      }
    })
  }

  function removeSelected() {
    if (!selectedIds.length) return
    if (!window.confirm(`确认删除选中的 ${selectedIds.length} 个媒体资源吗？本地上传文件会同步删除。`)) return

    startTransition(async () => {
      setMessage(null)
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
        setMessage(`已批量删除 ${deleted} 个媒体资源。`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '批量删除失败。')
      }
    })
  }

  function toggleSelected(id: string) {
    setSelectedIds((previous) => previous.includes(id) ? previous.filter((itemId) => itemId !== id) : [...previous, id])
  }

  return <div className="space-y-7" onPaste={handlePaste}>
    <Card padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">上传媒体资源</h2>
          <p className="mt-1 text-sm text-neutral-500">支持多选上传图片，也可以复制图片后聚焦本页面直接粘贴上传。文件名保留原文件名，冲突时自动追加序号。</p>
        </div>
        <form id="media-upload-form" action={upload} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-sm">选择图片<input name="file" type="file" accept="image/*" multiple className="max-w-72 text-sm" /></label>
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
      {media.length === 0 && <div className="rounded-lg border border-dashed border-neutral-300 px-5 py-16 text-center text-sm text-neutral-500 dark:border-neutral-700">还没有登记媒体资源。</div>}
    </Card>
    {message && <p className="text-sm text-neutral-500" role="status">{message}</p>}
  </div>
}
