'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useMemo, useRef, useState, useTransition } from 'react'

type DashboardCardDetail = {
  label: string
  value: string
}

type DashboardCardListItem = {
  title: string
  detail: string
}

type DashboardCard = {
  key: string
  label: string
  value?: number | string
  icon: string
  status: string
  description: string
  details: DashboardCardDetail[]
  listItems?: DashboardCardListItem[]
  href?: Route
}

const DASHBOARD_CARD_SIZES = ['1x1', '1x2', '2x2'] as const

type DashboardCardSize = (typeof DASHBOARD_CARD_SIZES)[number]

const DASHBOARD_CARD_SIZE_LABELS: Record<DashboardCardSize, string> = {
  '1x1': '1×1',
  '1x2': '1×2',
  '2x2': '2×2',
}

const DASHBOARD_CARD_SIZE_CLASSES: Record<DashboardCardSize, string> = {
  '1x1': '',
  '1x2': 'sm:col-span-2',
  '2x2': 'min-h-[22rem] sm:col-span-2 sm:row-span-2 sm:min-h-0',
}

type DashboardCardLayout = {
  key: string
  visible: boolean
  size: DashboardCardSize
}

type DashboardManagerProps = {
  cards: DashboardCard[]
  initialLayout: unknown
}

type ApiResponse = {
  error?: { message?: string }
  setting?: { value: unknown }
}

function isDashboardCardSize(value: unknown): value is DashboardCardSize {
  return typeof value === 'string' && DASHBOARD_CARD_SIZES.includes(value as DashboardCardSize)
}

function normalizeLayout(cards: DashboardCard[], value: unknown): DashboardCardLayout[] {
  const cardKeys = new Set(cards.map((card) => card.key))
  const rawItems = Array.isArray(value) ? value : []
  const configured = rawItems
    .filter((item): item is { key: string; visible?: unknown; size?: unknown } => typeof item === 'object' && item !== null && 'key' in item && typeof item.key === 'string')
    .filter((item) => cardKeys.has(item.key))
    .map((item) => ({
      key: item.key,
      visible: item.visible !== false,
      size: isDashboardCardSize(item.size) ? item.size : '1x1',
    }))
  const configuredKeys = new Set(configured.map((item) => item.key))
  const missing = cards
    .filter((card) => !configuredKeys.has(card.key))
    .map((card) => ({ key: card.key, visible: true, size: '1x1' as const }))

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
  size = '1x1',
  action,
  dragging,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onAction,
  onSizeChange,
}: {
  card: DashboardCard
  size?: DashboardCardSize
  action?: 'add' | 'remove'
  dragging?: boolean
  draggable?: boolean
  onDragStart?: React.DragEventHandler<HTMLElement>
  onDragOver?: React.DragEventHandler<HTMLElement>
  onDrop?: React.DragEventHandler<HTMLElement>
  onDragEnd?: React.DragEventHandler<HTMLElement>
  onAction?: () => void
  onSizeChange?: (size: DashboardCardSize) => void
}) {
  const actionLabel = action === 'add' ? '添加卡片' : '移除卡片'
  const actionIcon = action === 'add' ? 'fa-plus' : 'fa-xmark'
  const hasTopRightControls = action || onSizeChange
  const primaryValue = card.value === undefined ? '—' : card.value

  const cardContent = (
    <>
    {hasTopRightControls && (
      <div className="absolute right-3 top-3 flex items-center gap-1">
          {onSizeChange && (
            <label className="relative" onPointerDown={(event) => event.stopPropagation()}>
              <span className="sr-only">选择“{card.label}”的卡片尺寸</span>
              <select
                value={size}
                aria-label={`选择“${card.label}”的卡片尺寸`}
                onChange={(event) => onSizeChange(event.target.value as DashboardCardSize)}
                className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-600 outline-none transition-colors hover:border-neutral-300 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600 dark:focus:border-neutral-400 dark:focus:ring-neutral-800"
              >
                {DASHBOARD_CARD_SIZES.map((option) => (
                  <option key={option} value={option}>{DASHBOARD_CARD_SIZE_LABELS[option]}</option>
                ))}
              </select>
            </label>
          )}
          {action && (
            <button
              type="button"
              aria-label={`${actionLabel}：${card.label}`}
              title={actionLabel}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onAction?.()
              }}
              className="grid size-8 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
            >
              <i className={`fa-solid ${actionIcon} text-xs`} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {size === '1x1' && (
        <>
          <i className={`${card.icon} text-neutral-400`} aria-hidden="true" />
          <p className="mt-5 text-3xl font-semibold">{primaryValue}</p>
          <p className="mt-1 text-sm text-neutral-500">{card.label}</p>
          <p className="mt-4 text-xs text-neutral-400">{card.status}</p>
        </>
      )}

      {size === '1x2' && (
        <div className="flex h-full items-end justify-between gap-5">
          <div>
            <i className={`${card.icon} text-neutral-400`} aria-hidden="true" />
            <p className="mt-5 text-3xl font-semibold">{primaryValue}</p>
            <p className="mt-1 text-sm text-neutral-500">{card.label}</p>
          </div>
          <div className="mb-1 max-w-48 border-l border-neutral-200 pl-4 text-right dark:border-neutral-800">
            <p className="text-xs font-medium text-neutral-400">概览</p>
            <p className="mt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-300">{card.description}</p>
          </div>
        </div>
      )}

      {size === '2x2' && (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 pr-24">
            <div>
              <i className={`${card.icon} text-neutral-400`} aria-hidden="true" />
              <p className="mt-5 text-4xl font-semibold">{primaryValue}</p>
              <p className="mt-1 text-sm text-neutral-500">{card.label}</p>
            </div>
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">{card.status}</span>
          </div>
          <p className="mt-6 border-t border-neutral-200 pt-4 text-sm leading-6 text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">{card.description}</p>
          <dl className="mt-auto grid grid-cols-2 gap-3 pt-6">
            {card.details.map((detail) => (
              <div key={detail.label} className="rounded-md bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900">
                <dt className="text-xs text-neutral-500">{detail.label}</dt>
                <dd className="mt-1 text-sm font-medium text-neutral-800 dark:text-neutral-100">{detail.value}</dd>
              </div>
            ))}
          </dl>
          {card.listItems && card.listItems.length > 0 && (
            <ul className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
              {card.listItems.map((item) => (
                <li key={item.title} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 truncate text-neutral-700 dark:text-neutral-300">{item.title}</span>
                  <span className="shrink-0 text-xs text-neutral-500">{item.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )

  const cardClassName = `relative h-full rounded-lg border border-neutral-200 bg-white p-5 transition-colors dark:border-neutral-800 dark:bg-neutral-950 ${
    DASHBOARD_CARD_SIZE_CLASSES[size]
  } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging ? 'opacity-50' : ''}`

  if (!draggable && !action && card.href) {
    return (
      <Link
        href={card.href}
        className={`${cardClassName} block text-left hover:border-neutral-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 dark:hover:border-neutral-700 dark:focus-visible:ring-neutral-400 dark:focus-visible:ring-offset-neutral-950`}
        aria-label={`查看${card.label}`}
      >
        {cardContent}
      </Link>
    )
  }

  return (
    <section
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cardClassName}
    >
      {cardContent}
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

  function setCardSize(key: string, size: DashboardCardSize) {
    applyLayout(layout.map((item) => item.key === key ? { ...item, size } : item))
  }

  function moveCard(sourceKey: string, targetKey: string) {
    applyLayout(reorderItem(layout, sourceKey, targetKey))
  }

  function renderVisibleCard(card: DashboardCard) {
    const item = layout.find((layoutItem) => layoutItem.key === card.key)

    return (
      <DashboardStatCard
        key={card.key}
        card={card}
        size={item?.size ?? '1x1'}
        action={isManaging ? 'remove' : undefined}
        dragging={draggingKey === card.key}
        draggable={isManaging}
        onSizeChange={isManaging && item ? (size) => setCardSize(card.key, size) : undefined}
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
        {isManaging ? (<p className="text-sm text-neutral-500">当前显示 {orderedCards.length} / {cards.length} 张卡片</p>)
          : (<p></p>)}
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

      {orderedCards.length > 0 ? (
        <div className="grid auto-rows-40 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={isManaging ? '当前显示卡片' : undefined}>
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
