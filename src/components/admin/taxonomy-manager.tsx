'use client'

import { useState, useTransition } from 'react'

type Taxonomy = {
  id: string
  name: string
  slug: string
  description?: string | null
  sortOrder?: number
  _count: { articles: number }
}

type TaxonomyManagerProps = {
  type: 'categories' | 'tags'
  initialItems: Taxonomy[]
}

const labels = {
  categories: {
    singular: '分类',
    plural: '分类',
    description: '描述',
  },
  tags: {
    singular: '标签',
    plural: '标签',
    description: undefined,
  },
} as const

export function TaxonomyManager({ type, initialItems }: TaxonomyManagerProps) {
  const [items, setItems] = useState(initialItems)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const copy = labels[type]

  function request(url: string, options: RequestInit) {
    startTransition(async () => {
      setMessage(null)

      try {
        const response = await fetch(url, {
          ...options,
          headers: { 'Content-Type': 'application/json', ...options.headers },
        })
        const data = response.status === 204 ? null : (await response.json()) as { category?: Taxonomy; tag?: Taxonomy; error?: { message?: string } }

        if (!response.ok) {
          throw new Error(data?.error?.message ?? '操作失败。')
        }

        const item = data?.category ?? data?.tag
        if (item && options.method === 'POST') {
          setItems((previous) => [...previous, item].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')))
        }
        if (item && options.method === 'PATCH') {
          setItems((previous) => previous.map((existing) => existing.id === item.id ? { ...existing, ...item } : existing))
          setEditingId(null)
        }
        if (options.method === 'DELETE') {
          const id = url.split('/').at(-1)
          setItems((previous) => previous.filter((item) => item.id !== id))
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '操作失败，请稍后再试。')
      }
    })
  }

  function create(formData: FormData) {
    const payload = {
      name: String(formData.get('name') ?? ''),
      slug: String(formData.get('slug') ?? '') || undefined,
      ...(type === 'categories'
        ? {
            description: String(formData.get('description') ?? '') || null,
            sortOrder: Number(formData.get('sortOrder') ?? 0),
          }
        : {}),
    }

    request(`/api/admin/${type}`, { method: 'POST', body: JSON.stringify(payload) })
  }

  function update(id: string, formData: FormData) {
    const payload = {
      name: String(formData.get('name') ?? ''),
      slug: String(formData.get('slug') ?? '') || undefined,
      ...(type === 'categories'
        ? {
            description: String(formData.get('description') ?? '') || null,
            sortOrder: Number(formData.get('sortOrder') ?? 0),
          }
        : {}),
    }

    request(`/api/admin/${type}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  }

  return (
    <div className="space-y-7">
      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-base font-semibold">新建{copy.singular}</h2>
        <form action={create} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">名称<input name="name" required maxLength={80} className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900" /></label>
          <label className="grid gap-1.5 text-sm">Slug <span className="text-neutral-500">（留空自动生成）</span><input name="slug" maxLength={120} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900" /></label>
          {type === 'categories' && <><label className="grid gap-1.5 text-sm sm:col-span-2">描述<textarea name="description" rows={2} className="rounded-md border border-neutral-300 bg-white p-3 outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900" /></label><label className="grid gap-1.5 text-sm">排序<input name="sortOrder" type="number" defaultValue="0" className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900" /></label></>}
          <div className="flex items-end"><button type="submit" disabled={isPending} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">添加{copy.singular}</button></div>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800"><h2 className="font-semibold">全部{copy.plural}</h2></div>
        {items.length > 0 ? <div className="divide-y divide-neutral-100 dark:divide-neutral-900">{items.map((item) => (
          editingId === item.id ? (
            <form key={item.id} action={(formData) => update(item.id, formData)} className="grid gap-3 p-5 sm:grid-cols-2">
              <input name="name" defaultValue={item.name} required className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" />
              <input name="slug" defaultValue={item.slug} required className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" />
              {type === 'categories' && <><textarea name="description" defaultValue={item.description ?? ''} rows={2} className="rounded-md border border-neutral-300 bg-white p-3 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900 sm:col-span-2" /><input name="sortOrder" type="number" defaultValue={item.sortOrder ?? 0} className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" /></>}
              <div className="flex gap-3"><button type="submit" className="text-sm font-medium text-blue-600">保存</button><button type="button" onClick={() => setEditingId(null)} className="text-sm text-neutral-500">取消</button></div>
            </form>
          ) : (
            <div key={item.id} className="flex items-center justify-between gap-5 px-6 py-4">
              <div className="min-w-0"><p className="font-medium">{item.name}</p><p className="mt-1 truncate font-mono text-xs text-neutral-500">/{item.slug}{item.description ? ` · ${item.description}` : ''}</p></div>
              <div className="flex shrink-0 items-center gap-4 text-sm"><span className="text-neutral-500">{item._count.articles} 篇</span><button type="button" onClick={() => setEditingId(item.id)} className="text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-50">编辑</button><button type="button" onClick={() => request(`/api/admin/${type}/${item.id}`, { method: 'DELETE' })} className="text-red-600 hover:text-red-700">删除</button></div>
            </div>
          )
        ))}</div> : <p className="px-6 py-14 text-center text-sm text-neutral-500">暂无{copy.plural}。</p>}
      </section>

      {message && <p className="text-sm text-neutral-500" role="status">{message}</p>}
    </div>
  )
}
