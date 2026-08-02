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

  if (sourceIndex === -1 || targetIndex === -1 || items[sourceIndex].visible === false || items[targetIndex].visible === false) {
    return items
  }

  const next = [...items]
  const [source] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, source)
  return next
}

function DashboardStatCard({
  card,
  action,
  dragging,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onAction,
}: {
  card: DashboardCard
  action?: 'add' | 'remove'
  dragging?: boolean
  draggable?: boolean
  onDragStart?: React.DragEventHandler<HTMLElement>
  onDragOver?: React.DragEventHandler<HTMLElement>
  onDrop?: React.DragEventHandler<HTMLElement>
  onDragEnd?: React.DragEventHandler<HTMLElement>
  onAction?: () => void
}) {
  const actionLabel = action === 'add' ? '添加卡片' : '移除卡片'
  const actionIcon = action === 'add' ? 'fa-plus' : 'fa-xmark'

  return (
    <section
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`relative rounded-lg border border-neutral-200 bg-white p-5 transition-colors dark:border-neutral-800 dark:bg-neutral-950 ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${dragging ? 'opacity-50' : ''}`}
    >
      {action && (
        <button
          type="button"
          aria-label={`${actionLabel}：${card.label}`}
          title={actionLabel}
          onClick={(event) => {
            event.stopPropagation()
            onAction?.()
          }}
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
        >
          <i className={`fa-solid ${actionIcon} text-xs`} aria-hidden="true" />
        </button>
      )}
      <i className={`${card.icon} text-neutral-400`} aria-hidden="true" />
      <p className="mt-5 text-3xl font-semibold">{card.value}</p>
      <p className="mt-1 text-sm text-neutral-500">{card.label}</p>
    </section>
  )
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
  const hiddenCards = cards.filter((card) => layout.find((item) => item.key === card.key)?.visible === false)

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

  function setCardVisibility(key: string, visible: boolean) {
    applyLayout(layout.map((item) => item.key === key ? { ...item, visible } : item))
  }

  function moveCard(sourceKey: string, targetKey: string) {
    applyLayout(reorderItem(layout, sourceKey, targetKey))
  }

  function renderVisibleCard(card: DashboardCard) {
    return (
      <DashboardStatCard
        key={card.key}
        card={card}
        action={isManaging ? 'remove' : undefined}
        dragging={draggingKey === card.key}
        draggable={isManaging}
        onDragStart={(event) => {
          draggingKeyRef.current = card.key
          setDraggingKey(card.key)
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', card.key)
        }}
        onDragOver={(event) => {
          if (!isManaging) {
            return
          }

          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(event) => {
          if (!isManaging) {
            return
          }

          event.preventDefault()
          const sourceKey = event.dataTransfer.getData('text/plain') || draggingKeyRef.current
          if (sourceKey) {
            moveCard(sourceKey, card.key)
          }
          draggingKeyRef.current = null
          setDraggingKey(null)
        }}
        onDragEnd={() => {
          draggingKeyRef.current = null
          setDraggingKey(null)
        }}
        onAction={() => setCardVisibility(card.key, false)}
      />
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">当前显示 {orderedCards.length} / {cards.length} 张卡片</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-neutral-500" aria-live="polite">{isPending ? '正在自动保存…' : message}</span>
          <button
            type="button"
            onClick={() => setIsManaging((value) => !value)}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            aria-expanded={isManaging}
          >
            <i className={`fa-solid ${isManaging ? 'fa-xmark' : 'fa-sliders'} text-xs`} aria-hidden="true" />
            {isManaging ? '退出排序' : '管理卡片'}
          </button>
        </div>
      </div>

      {isManaging && (
        <section className="mb-5 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950" aria-label="管理仪表盘卡片">
          <h2 className="font-semibold">管理概览卡片</h2>
          <p className="mt-1 text-sm text-neutral-500">拖动上方卡片调整排序；右上角按钮用于移除或添加，修改后会自动保存。</p>
        </section>
      )}

      {orderedCards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={isManaging ? '当前显示卡片' : undefined}>
          {orderedCards.map(renderVisibleCard)}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          暂无显示的概览卡片。点击“管理卡片”重新启用。
        </div>
      )}

      {isManaging && (
        <section className="mt-8 border-t border-neutral-200 pt-6 dark:border-neutral-800" aria-label="未显示卡片">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold">未显示卡片</h2>
            <span className="text-sm text-neutral-500">按默认顺序展示，不支持拖动</span>
          </div>
          {hiddenCards.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {hiddenCards.map((card) => (
                <DashboardStatCard key={card.key} card={card} action="add" onAction={() => setCardVisibility(card.key, true)} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
              所有卡片都在显示区域。
            </div>
          )}
        </section>
      )}
    </div>
  )
}
