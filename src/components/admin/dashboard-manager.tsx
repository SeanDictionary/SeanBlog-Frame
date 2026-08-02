'use client'

import { useMemo, useRef, useState, useTransition } from 'react'

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

function reorderItem(items: DashboardCardLayout[], sourceKey: string, targetKey: string) {
  if (sourceKey === targetKey) {
    return items
  }

  const sourceIndex = items.findIndex((item) => item.key === sourceKey)
  const targetIndex = items.findIndex((item) => item.key === targetKey)

  if (sourceIndex === -1 || targetIndex === -1) {
    return items
  }

  const next = [...items]
  const [source] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, source)
  return next
}

export function DashboardManager({ cards, initialLayout }: DashboardManagerProps) {
  const [layout, setLayout] = useState(() => normalizeLayout(cards, initialLayout))
  const [isManaging, setIsManaging] = useState(false)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const draggingKeyRef = useRef<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const cardMap = useMemo(() => new Map(cards.map((card) => [card.key, card])), [cards])
  const orderedCards = layout
    .filter((item) => item.visible)
    .map((item) => cardMap.get(item.key))
    .filter((card): card is DashboardCard => Boolean(card))

  function persistLayout(nextLayout: DashboardCardLayout[]) {
    startTransition(async () => {
      setMessage('正在自动保存…')

      try {
        const response = await fetch('/api/admin/settings/adminDashboardCards', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: nextLayout }),
        })
        const data = (await response.json()) as ApiResponse

        if (!response.ok || !data.setting) {
          throw new Error(data.error?.message ?? '自动保存失败。')
        }

        setMessage('已自动保存。')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '自动保存失败。')
      }
    })
  }

  function applyLayout(nextLayout: DashboardCardLayout[]) {
    setLayout(nextLayout)
    persistLayout(nextLayout)
  }

  function toggleCard(key: string) {
    applyLayout(layout.map((item) => item.key === key ? { ...item, visible: !item.visible } : item))
  }

  function moveCard(sourceKey: string, targetKey: string) {
    applyLayout(reorderItem(layout, sourceKey, targetKey))
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
              <p className="mt-1 text-sm text-neutral-500">拖动卡片调整排序，勾选控制显示；修改后会自动保存。</p>
            </div>
            <span className="text-sm text-neutral-500" aria-live="polite">{isPending ? '正在自动保存…' : message}</span>
          </div>

          <ul className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {layout.map((item) => {
              const card = cardMap.get(item.key)

              if (!card) {
                return null
              }

              return (
                <li
                  key={item.key}
                  draggable
                  onDragStart={(event) => {
                    draggingKeyRef.current = item.key
                    setDraggingKey(item.key)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', item.key)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const sourceKey = event.dataTransfer.getData('text/plain') || draggingKeyRef.current
                    if (sourceKey) {
                      moveCard(sourceKey, item.key)
                    }
                    draggingKeyRef.current = null
                    setDraggingKey(null)
                  }}
                  onDragEnd={() => {
                    draggingKeyRef.current = null
                    setDraggingKey(null)
                  }}
                  className={`flex cursor-grab flex-wrap items-center justify-between gap-3 py-3 text-sm active:cursor-grabbing ${draggingKey === item.key ? 'opacity-50' : ''}`}
                >
                  <label className="inline-flex min-w-0 items-center gap-3 font-medium">
                    <input type="checkbox" checked={item.visible} onChange={() => toggleCard(item.key)} />
                    <i className={`${card.icon} w-4 text-center text-neutral-400`} aria-hidden="true" />
                    <span>{card.label}</span>
                  </label>
                  <span className="inline-flex items-center gap-2 text-xs text-neutral-400" aria-hidden="true">
                    <i className="fa-solid fa-grip-vertical" />
                    拖动排序
                  </span>
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
