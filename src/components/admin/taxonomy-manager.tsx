'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'

import { createSlugFromTitle } from '@/lib/content/pinyin-slug'

type TaxonomyType = 'categories' | 'tags'
type SortKey = 'name' | 'slug' | 'articleCount'
type SortOrder = 'asc' | 'desc'

type Taxonomy = {
  id: string
  name: string
  slug: string
  description?: string | null
  _count: { articles: number }
}

type TaxonomyManagerProps = {
  type: TaxonomyType
  initialItems: Taxonomy[]
}

type SlugCheckResponse = {
  slug: string
  available: boolean
  message?: string | null
}

type TaxonomyResponse = {
  category?: Taxonomy
  tag?: Taxonomy
  error?: { message?: string }
}

type FormState = {
  name: string
  slug: string
  description: string
}

const labels = {
  categories: {
    singular: '分类',
    plural: '分类',
    articleQueryKey: 'category',
    itemKey: 'category',
    descriptionPlaceholder: '用于说明该分类的内容范围。',
  },
  tags: {
    singular: '标签',
    plural: '标签',
    articleQueryKey: 'tag',
    itemKey: 'tag',
    descriptionPlaceholder: '用于补充说明该标签的使用场景。',
  },
} as const

const emptyForm: FormState = { name: '', slug: '', description: '' }
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DEFAULT_CATEGORY_SLUG = 'uncategorized'

function getInitialForm(item?: Taxonomy | null): FormState {
  return item
    ? {
        name: item.name,
        slug: item.slug,
        description: item.description ?? '',
      }
    : emptyForm
}

function getItemFromResponse(type: TaxonomyType, data: TaxonomyResponse | null) {
  return type === 'categories' ? data?.category : data?.tag
}

function compareText(left: string, right: string, order: SortOrder) {
  const result = left.localeCompare(right, 'zh-CN')
  return order === 'asc' ? result : -result
}

function compareNumber(left: number, right: number, order: SortOrder) {
  const result = left - right
  return order === 'asc' ? result : -result
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function TaxonomyManager({ type, initialItems }: TaxonomyManagerProps) {
  const [items, setItems] = useState(initialItems)
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.id ?? null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<FormState>(() => getInitialForm(initialItems[0] ?? null))
  const [slugTouched, setSlugTouched] = useState(Boolean(initialItems[0]?.slug))
  const [slugError, setSlugError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isSlugPending, startSlugTransition] = useTransition()
  const selectedItem = items.find((item) => item.id === selectedId) ?? null
  const isSelectedDefaultCategory = type === 'categories' && selectedItem?.slug === DEFAULT_CATEGORY_SLUG
  const copy = labels[type]
  const selectedCount = selectedIds.size

  const visibleItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase()
    const filtered = keyword
      ? items.filter((item) => `${item.name} ${item.slug}`.toLocaleLowerCase().includes(keyword))
      : items

    return [...filtered].sort((left, right) => {
      if (sortKey === 'articleCount') return compareNumber(left._count.articles, right._count.articles, sortOrder)
      return compareText(left[sortKey], right[sortKey], sortOrder)
    })
  }, [items, search, sortKey, sortOrder])

  const selectedVisibleCount = visibleItems.filter((item) => selectedIds.has(item.id)).length
  const allVisibleSelected = visibleItems.length > 0 && selectedVisibleCount === visibleItems.length

  useEffect(() => {
    setItems(initialItems)
    setSelectedId((current) => current && initialItems.some((item) => item.id === current) ? current : initialItems[0]?.id ?? null)
  }, [initialItems])

  useEffect(() => {
    setForm(getInitialForm(selectedItem))
    setSlugTouched(Boolean(selectedItem?.slug))
    setSlugError(null)
  }, [selectedItem])

  useEffect(() => {
    if (!slugTouched) {
      setForm((previous) => ({ ...previous, slug: createSlugFromTitle(previous.name) }))
    }
  }, [form.name, slugTouched])

  useEffect(() => {
    const slug = form.slug.trim()
    if (!slug) {
      setSlugError('Slug 必填。')
      return
    }

    if (!slugPattern.test(slug)) {
      setSlugError('Slug 只能包含小写字母、数字和短横线。')
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      startSlugTransition(async () => {
        try {
          const params = new URLSearchParams({ slug })
          if (selectedItem?.id) params.set('excludeId', selectedItem.id)
          const response = await fetch(`/api/admin/${type}/slug?${params.toString()}`, { signal: controller.signal })
          const data = (await response.json()) as SlugCheckResponse

          if (!response.ok) throw new Error(data.message ?? 'Slug 校验失败。')
          setSlugError(data.available ? null : data.message ?? `该 Slug 已被其他${copy.singular}使用。`)
          if (data.slug && data.slug !== form.slug) {
            setForm((previous) => ({ ...previous, slug: data.slug }))
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            setSlugError(error instanceof Error ? error.message : 'Slug 校验失败。')
          }
        }
      })
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [copy.singular, form.slug, selectedItem?.id, type])

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function resetToCreate() {
    setSelectedId(null)
    setSelectedIds(new Set())
    setForm(emptyForm)
    setSlugTouched(false)
    setSlugError('Slug 必填。')
    setMessage(null)
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortOrder((current) => current === 'asc' ? 'desc' : 'asc')
      return
    }

    setSortKey(nextKey)
    setSortOrder(nextKey === 'articleCount' ? 'desc' : 'asc')
  }

  function toggleSelected(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (allVisibleSelected) {
        visibleItems.forEach((item) => next.delete(item.id))
      } else {
        visibleItems.forEach((item) => next.add(item.id))
      }
      return next
    })
  }

  function upsertItem(item: Taxonomy) {
    setItems((previous) => {
      const exists = previous.some((existing) => existing.id === item.id)
      const next = exists
        ? previous.map((existing) => existing.id === item.id ? { ...existing, ...item } : existing)
        : [...previous, item]
      return [...next].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
    })
    setSelectedId(item.id)
    setSelectedIds(new Set())
  }

  function validateForm() {
    if (!form.name.trim()) {
      setMessage(`${copy.singular}名称不能为空。`)
      return false
    }

    if (!form.slug.trim()) {
      setSlugError('Slug 必填。')
      setMessage('Slug 不能为空。')
      return false
    }

    if (isSlugPending) {
      setMessage('Slug 正在校验，请稍后再保存。')
      return false
    }

    if (slugError) {
      setMessage(slugError)
      return false
    }

    return true
  }

  function save() {
    if (!validateForm()) return

    startTransition(async () => {
      setMessage(null)

      try {
        const payload = {
          name: form.name,
          slug: form.slug,
          description: form.description || null,
        }
        const response = await fetch(selectedItem ? `/api/admin/${type}/${selectedItem.id}` : `/api/admin/${type}`, {
          method: selectedItem ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = response.status === 204 ? null : (await response.json()) as TaxonomyResponse
        const item = getItemFromResponse(type, data)

        if (!response.ok || !item) {
          throw new Error(data?.error?.message ?? '保存失败。')
        }

        upsertItem(item)
        setMessage(`已保存${copy.singular}「${item.name}」。`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '保存失败，请稍后再试。')
      }
    })
  }

  function deleteItems(ids: string[]) {
    if (!ids.length) return

    if (type === 'categories' && ids.some((id) => items.find((item) => item.id === id)?.slug === DEFAULT_CATEGORY_SLUG)) {
      setMessage('默认分类“未分类”不可删除。')
      return
    }

    const names = ids
      .map((id) => items.find((item) => item.id === id)?.name)
      .filter(Boolean)
      .join('、')
    if (!window.confirm(`确认删除 ${ids.length} 个${copy.singular}吗？${names ? `\n${names}` : ''}\n文章不会被删除，但会失去该关联。`)) return

    startTransition(async () => {
      setMessage(null)

      try {
        const response = await fetch(`/api/admin/${type}/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
        const data = (await response.json()) as { deleted?: number; error?: { message?: string } }

        if (!response.ok) {
          throw new Error(data.error?.message ?? '删除失败。')
        }

        setItems((previous) => previous.filter((item) => !ids.includes(item.id)))
        setSelectedIds(new Set())
        if (selectedId && ids.includes(selectedId)) {
          const nextItem = items.find((item) => !ids.includes(item.id)) ?? null
          setSelectedId(nextItem?.id ?? null)
        }
        setMessage(`已删除 ${data.deleted ?? ids.length} 个${copy.singular}。`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '删除失败，请稍后再试。')
      }
    })
  }

  function exportSelected() {
    const selected = items
      .filter((item) => selectedIds.has(item.id))
      .map(({ id: _id, _count: _count, ...item }) => item)

    if (!selected.length) {
      setMessage(`请先选择要导出的${copy.singular}。`)
      return
    }

    downloadJson(`${type}.json`, { type, items: selected })
    setMessage(`已导出 ${selected.length} 个${copy.singular}。`)
  }

  const detailTitle = selectedItem ? `编辑${copy.singular}` : `新建${copy.singular}`

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="border-b border-neutral-200 p-5 dark:border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{copy.plural}列表</h2>
            </div>
            <button type="button" onClick={resetToCreate} className="rounded-full bg-neutral-950 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-300">
              新建{copy.singular}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="min-w-0 flex-1 text-sm">
              <span className="sr-only">搜索{copy.singular}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`搜索${copy.singular}名称或 slug`}
                className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 outline-none transition-colors focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/50">
          <label className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label={`选择当前显示的${copy.singular}`} />
            已选 {selectedCount} / {visibleItems.length}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {(['name', 'slug', 'articleCount'] as SortKey[]).map((key) => (
              <button key={key} type="button" onClick={() => toggleSort(key)} className={`rounded-full px-3 py-1 transition-colors ${sortKey === key ? 'bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950' : 'text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800'}`}>
                {key === 'name' ? '名称' : key === 'slug' ? 'Slug' : '文章数量'} {sortKey === key ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </button>
            ))}
            <button type="button" onClick={exportSelected} disabled={!selectedCount} className="rounded-full border border-neutral-300 px-3 py-1 text-neutral-600 transition-colors hover:bg-white disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-950">导出</button>
            <button type="button" onClick={() => deleteItems([...selectedIds])} disabled={!selectedCount || isPending} className="rounded-full border border-red-200 px-3 py-1 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40 dark:border-red-900/70 dark:hover:bg-red-950/30">批量删除</button>
          </div>
        </div>

        {visibleItems.length > 0 ? (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {visibleItems.map((item) => {
              const isSelected = item.id === selectedId
              return (
                <div key={item.id} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 transition-colors ${isSelected ? 'bg-blue-50/70 dark:bg-blue-950/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60'}`}>
                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`选择${item.name}`} />
                  <button type="button" onClick={() => setSelectedId(item.id)} className="min-w-0 text-left">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="block truncate font-medium text-neutral-950 dark:text-neutral-50">{item.name}</span>
                      <span className="mt-1 block truncate font-mono text-xs text-neutral-500">/{item.slug}</span>
                    </div>
                    <span className="mt-1 block truncate text-xs text-neutral-500">{item.description? `${item.description.substring(0, 20)} ${item.description.length > 20 ? '...' : ''}` : '暂无描述'}</span>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                    <Link href={`/admin/articles?${copy.articleQueryKey}=${encodeURIComponent(item.slug)}`} className="text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-50" onClick={(event) => event.stopPropagation()}>{item._count.articles} 篇文章</Link>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="px-6 py-16 text-center text-sm text-neutral-500">暂无匹配的{copy.singular}。</p>
        )}
      </section>

      <aside className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 lg:sticky lg:top-6 lg:self-start">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="mt-1 text-xl font-semibold">{detailTitle}</h2>
            <p className="text-sm text-neutral-500">{selectedItem ? selectedItem.name : ''}</p>
          </div>
          {selectedItem && (
            <button type="button" onClick={() => deleteItems([selectedItem.id])} disabled={isPending || isSelectedDefaultCategory} className="rounded-full border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/70 dark:hover:bg-red-950/30">
              删除
            </button>
          )}
        </div>

        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">
            {copy.singular}名称
            <input
              value={form.name}
              onChange={(event) => updateForm('name', event.target.value)}
              required
              maxLength={80}
              disabled={isSelectedDefaultCategory}
              className="h-10 rounded-lg border border-neutral-300 bg-white px-3 font-normal outline-none transition-colors focus:border-blue-600 disabled:bg-neutral-100 disabled:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400 dark:disabled:bg-neutral-900/60"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Slug
            <input
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true)
                updateForm('slug', event.target.value)
              }}
              required
              maxLength={120}
              aria-invalid={Boolean(slugError)}
              aria-describedby={`${type}-slug-help`}
              disabled={isSelectedDefaultCategory}
              className="h-10 rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm font-normal outline-none transition-colors focus:border-blue-600 aria-invalid:border-red-500 disabled:bg-neutral-100 disabled:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400 dark:disabled:bg-neutral-900/60"
            />
            <span id={`${type}-slug-help`} className={`text-xs ${slugError ? 'text-red-600' : 'text-neutral-500'}`}>
              {slugError ?? (isSlugPending ? '正在校验 Slug…' : 'Slug 可用。')}
            </span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            描述
            <textarea
              value={form.description}
              onChange={(event) => updateForm('description', event.target.value)}
              rows={5}
              maxLength={500}
              placeholder={copy.descriptionPlaceholder}
              className="rounded-lg border border-neutral-300 bg-white p-3 font-normal outline-none transition-colors focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400"
            />
          </label>
          <button type="button" onClick={save} disabled={isPending || Boolean(slugError) || isSlugPending} className="h-10 rounded-lg bg-neutral-950 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-300">
            {isPending ? '正在保存…' : selectedItem ? '保存修改' : `新建${copy.singular}`}
          </button>
        </div>

        {message && <p className="mt-4 text-sm text-neutral-500" role="status">{message}</p>}
      </aside>
    </div>
  )
}
