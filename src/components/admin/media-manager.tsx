'use client'

import { useState, useTransition } from 'react'

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

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaManager({ initialMedia }: MediaManagerProps) {
  const [media, setMedia] = useState(initialMedia)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function create(formData: FormData) {
    startTransition(async () => {
      try {
        const payload = {
          filename: String(formData.get('filename') ?? ''),
          url: String(formData.get('url') ?? ''),
          key: String(formData.get('key') ?? ''),
          size: Number(formData.get('size') ?? 0),
          mimeType: String(formData.get('mimeType') ?? ''),
        }
        const response = await fetch('/api/admin/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const data = (await response.json()) as { media?: Media; error?: { message?: string } }
        if (!response.ok || !data.media) throw new Error(data.error?.message ?? '登记失败。')
        setMedia((previous) => [data.media!, ...previous])
        setMessage('媒体信息已登记。')
        document.getElementById('media-form')?.reset()
      } catch (error) { setMessage(error instanceof Error ? error.message : '登记失败。') }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/media/${id}`, { method: 'DELETE' })
        if (!response.ok) throw new Error('删除失败。')
        setMedia((previous) => previous.filter((item) => item.id !== id))
      } catch (error) { setMessage(error instanceof Error ? error.message : '删除失败。') }
    })
  }

  return <div className="space-y-7">
    <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"><h2 className="font-semibold">登记媒体资源</h2><p className="mt-1 text-sm text-neutral-500">当前后端仅保存外部存储中的文件元数据，请先将文件上传到你的对象存储或 CDN。</p><form id="media-form" action={create} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm">文件名<input name="filename" required className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label><label className="grid gap-1.5 text-sm">存储 Key<input name="key" required className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label><label className="grid gap-1.5 text-sm sm:col-span-2">URL<input name="url" required className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label><label className="grid gap-1.5 text-sm">大小（字节）<input name="size" type="number" min="0" required className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label><label className="grid gap-1.5 text-sm">MIME 类型<input name="mimeType" placeholder="image/png" required className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label><div><button disabled={isPending} type="submit" className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">登记资源</button></div></form></section>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{media.map((item) => <article key={item.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"><a href={item.url} target="_blank" rel="noreferrer" className="grid aspect-video place-items-center bg-neutral-100 dark:bg-neutral-900">{item.mimeType.startsWith('image/') ? <img src={item.url} alt="" className="size-full object-cover" /> : <i className="fa-regular fa-file text-2xl text-neutral-400" />}</a><div className="p-4"><p className="truncate font-medium">{item.filename}</p><p className="mt-1 text-xs text-neutral-500">{item.mimeType} · {formatSize(item.size)}</p><button type="button" disabled={isPending} onClick={() => remove(item.id)} className="mt-4 text-sm text-red-600">删除记录</button></div></article>)}</section>
    {media.length === 0 && <div className="rounded-lg border border-dashed border-neutral-300 px-5 py-16 text-center text-sm text-neutral-500 dark:border-neutral-700">还没有登记媒体资源。</div>}{message && <p className="text-sm text-neutral-500" role="status">{message}</p>}
  </div>
}
