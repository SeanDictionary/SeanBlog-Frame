'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

type DashboardCard = {
  key: string
  label: string
  value: number
  icon: string
}

type DashboardCardLayout = {
  key: string
  visible: boolean
}

type DashboardManagerProps = {
  cards: DashboardCard[]
  initialLayout: unknown
}

type ApiResponse = {
  error?: { message?: string }
  setting?: { value: unknown }
}

function normalizeLayout(cards: DashboardCard[], value: unknown): DashboardCardLayout[] {
  const cardKeys = new Set(cards.map((card) => card.key))
  const rawItems = Array.isArray(value) ? value : []
  const configured = rawItems
    .filter((item): item is { key: string; visible?: unknown } => typeof item === 'object' && item !== null && 'key' in item && typeof item.key === 'string')
    .filter((item) => cardKeys.has(item.key))
    .map((item) => ({ key: item.key, visible: item.visible !== false }))
  const configuredKeys = new Set(configured.map((item) => item.key))
  const missing = cards
    .filter((card) => !configuredKeys.has(card.key))
    .map((card) => ({ key: card.key, visible: true }))

  return [...configured, ...missing]
}

function moveItem(items: DashboardCardLayout[], index: number, direction: -1 | 1) {
  const target = index + direction

  if (target < 0 || target >= items.length) {
    return items
  }

  const next = [...items]
  const current = next[index]
  next[index] = next[target]
  next[target] = current
  return next
}

export function DashboardManager({ cards, initialLayout }: DashboardManagerProps) {
  const router = useRouter()
  const [layout, setLayout] = useState(() => normalizeLayout(cards, initialLayout))
  const [isManaging, setIsManaging] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const cardMap = useMemo(() => new Map(cards.map((card) => [card.key, card])), [cards])
  const orderedCards = layout
    .filter((item) => item.visible)
    .map((item) => cardMap.get(item.key))
    .filter((card): card is DashboardCard => Boolean(card))

  function toggleCard(key: string) {
    setLayout((current) => current.map((item) => item.key === key ? { ...item, visible: !item.visible } : item))
  }

  function moveCard(index: number, direction: -1 | 1) {
    setLayout((current) => moveItem(current, index, direction))
  }

  function saveLayout() {
    startTransition(async () => {
      setMessage(null)

      try {
        const response = await fetch('/api/admin/settings/adminDashboardCards', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: layout }),
        })
        const data = (await response.json()) as ApiResponse

        if (!response.ok || !data.setting) {
          throw new Error(data.error?.message ?? '保存失败。')
        }

        setMessage('仪表盘卡片布局已保存。')
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '保存失败。')
      }
    })
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">当前显示 {orderedCards.length} / {cards.length} 张卡片</p>
        <button
          type="button"
          onClick={() => setIsManaging((value) => !value)}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          aria-expanded={isManaging}
        >
          <i className="fa-solid fa-sliders text-xs" aria-hidden="true" />
          管理卡片
        </button>
      </div>

      {isManaging && (
        <section className="mb-5 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950" aria-label="管理仪表盘卡片">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">管理概览卡片</h2>
              <p className="mt-1 text-sm text-neutral-500">勾选控制显示，上下移动控制排序。</p>
            </div>
            <button
              type="button"
              onClick={saveLayout}
              disabled={isPending}
              className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950"
            >
              {isPending ? '保存中…' : '保存布局'}
            </button>
          </div>

          <ul className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {layout.map((item, index) => {
              const card = cardMap.get(item.key)

              if (!card) {
                return null
              }

              return (
                <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <label className="inline-flex min-w-0 items-center gap-3 font-medium">
                    <input type="checkbox" checked={item.visible} onChange={() => toggleCard(item.key)} />
                    <i className={`${card.icon} w-4 text-center text-neutral-400`} aria-hidden="true" />
                    <span>{card.label}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => moveCard(index, -1)} disabled={index === 0} className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700">上移</button>
                    <button type="button" onClick={() => moveCard(index, 1)} disabled={index === layout.length - 1} className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700">下移</button>
                  </div>
                </li>
              )
            })}
          </ul>

          {message && <p className="mt-4 text-sm text-neutral-500" role="status">{message}</p>}
        </section>
      )}

      {orderedCards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {orderedCards.map((stat) => (
            <section key={stat.key} className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <i className={`${stat.icon} text-neutral-400`} aria-hidden="true" />
              <p className="mt-5 text-3xl font-semibold">{stat.value}</p>
              <p className="mt-1 text-sm text-neutral-500">{stat.label}</p>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          暂无显示的概览卡片。点击“管理卡片”重新启用。
        </div>
      )}
    </div>
  )
}
