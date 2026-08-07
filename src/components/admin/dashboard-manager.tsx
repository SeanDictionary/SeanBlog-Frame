'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'

type DashboardCardSize = '1x1' | '1x2' | '2x2'

type DashboardCardListItem = {
  title: string
  detail: string
  href: Route
}

type DashboardCardTrendPoint = {
  date: string
  views: number
  visitors: number
}

type DashboardCardInsight = {
  label: string
  value: string
  href: Route
}

type DashboardCard = {
  key: string
  label: string
  value?: number | string
  icon: string
  href: Route
  secondaryLabel?: string
  secondaryHref?: Route
  listTitle?: string
  listItems?: DashboardCardListItem[]
  trend?: DashboardCardTrendPoint[]
  insights?: DashboardCardInsight[]
}

const DASHBOARD_CARD_SIZES = ['1x1', '1x2', '2x2'] as const

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

type DashboardCardKind = 'summary' | 'articleHeat' | 'comments' | 'create' | 'siteAnalytics'

type DashboardCardConfiguration = {
  allowedSizes: readonly DashboardCardSize[]
  defaultSize: DashboardCardSize
  kind: DashboardCardKind
}

const DASHBOARD_CARD_CONFIG: Record<string, DashboardCardConfiguration> = {
  drafts: { allowedSizes: ['1x1', '1x2'], defaultSize: '1x1', kind: 'summary' },
  articles: { allowedSizes: ['1x1', '1x2'], defaultSize: '1x1', kind: 'summary' },
  articleHeat: { allowedSizes: ['1x1', '1x2', '2x2'], defaultSize: '1x2', kind: 'articleHeat' },
  comments: { allowedSizes: ['1x2'], defaultSize: '1x2', kind: 'comments' },
  quickCreateArticle: { allowedSizes: ['1x1'], defaultSize: '1x1', kind: 'create' },
  siteAnalytics: { allowedSizes: ['1x1', '1x2', '2x2'], defaultSize: '1x2', kind: 'siteAnalytics' },
}

const DEFAULT_DASHBOARD_CARD_CONFIG: DashboardCardConfiguration = {
  allowedSizes: ['1x1'],
  defaultSize: '1x1',
  kind: 'summary',
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

function getDashboardCardConfig(key: string) {
  return DASHBOARD_CARD_CONFIG[key] ?? DEFAULT_DASHBOARD_CARD_CONFIG
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
    .map((item) => {
      const config = getDashboardCardConfig(item.key)

      return {
        key: item.key,
        visible: item.visible !== false,
        size: isDashboardCardSize(item.size) && config.allowedSizes.includes(item.size) ? item.size : config.defaultSize,
      }
    })
  const configuredKeys = new Set(configured.map((item) => item.key))
  const missing = cards
    .filter((card) => !configuredKeys.has(card.key))
    .map((card) => {
      const config = getDashboardCardConfig(card.key)

      return { key: card.key, visible: true, size: config.defaultSize }
    })

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

function formatNumber(value: number | string | undefined) {
  return typeof value === 'number' ? value.toLocaleString('zh-CN') : value ?? '—'
}

function MiniLineChart({ points }: { points: DashboardCardTrendPoint[] }) {
  const width = 280
  const height = 96
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.views, point.visitors]))
  const buildPath = (key: 'views' | 'visitors') => points.map((point, index) => {
    const x = points.length > 1 ? (index / (points.length - 1)) * width : width / 2
    const y = height - (point[key] / maxValue) * height
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="近 30 天访问量和访问人数趋势" className="h-24 w-full overflow-visible rounded-lg bg-neutral-50 p-2 dark:bg-neutral-900">
        <path d={buildPath('views')} fill="none" stroke="#2563eb" strokeLinecap="round" strokeWidth="2" />
        <path d={buildPath('visitors')} fill="none" stroke="#d97706" strokeDasharray="5 5" strokeLinecap="round" strokeWidth="2" />
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-blue-600" aria-hidden="true" />访问量</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-amber-600" aria-hidden="true" />访问人数</span>
      </div>
    </div>
  )
}

function MetricLink({ card }: { card: DashboardCard }) {
  return (
    <Link href={card.href} className="block rounded-lg p-2 -m-2 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:hover:bg-neutral-900">
      <i className={`${card.icon} text-neutral-400`} aria-hidden="true" />
      <p className="mt-5 text-3xl font-semibold tracking-tight">{formatNumber(card.value)}</p>
      <p className="mt-1 text-sm text-neutral-500">{card.label}</p>
    </Link>
  )
}

function SummaryCardContent({ card, size }: { card: DashboardCard; size: DashboardCardSize }) {
  if (size === '1x2') {
    return (
      <div className="grid h-full gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <MetricLink card={card} />
        <Link href={card.secondaryHref ?? card.href} className="flex min-w-0 flex-col justify-end border-t border-neutral-200 pt-4 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:border-neutral-800 dark:hover:text-blue-300 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <span className="text-xs font-medium text-neutral-400">最新一篇</span>
          <span className="mt-2 line-clamp-3 text-base font-medium leading-6">{card.secondaryLabel ?? '未命名'}</span>
        </Link>
      </div>
    )
  }

  return <MetricLink card={card} />
}

function ArticleHeatContent({ card, size }: { card: DashboardCard; size: DashboardCardSize }) {
  if (size === '1x1') {
    return <MetricLink card={card} />
  }

  return (
    <div className={`${size === '2x2' ? 'flex h-full flex-col' : 'grid h-full gap-5 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]'}`}>
      <div className={size === '2x2' ? '' : 'flex flex-col justify-end'}>
        <MetricLink card={card} />
      </div>
      <div className={`${size === '2x2' ? 'mt-6 border-t pt-4 dark:border-neutral-800' : 'border-t pt-4 dark:border-neutral-800 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0'}`}>
        <p className="text-xs font-medium text-neutral-400">热度最高前五篇</p>
        <ul className="mt-3 space-y-2">
          {(card.listItems ?? []).length > 0 ? card.listItems?.map((item) => (
            <li key={`${item.title}-${item.detail}`}>
              <Link href={item.href} className="flex min-w-0 items-center justify-between gap-3 rounded-md px-2 py-1.5 -mx-2 text-sm transition-colors hover:bg-neutral-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-blue-300">
                <span className="min-w-0 truncate">{item.title}</span>
                <span className="shrink-0 text-xs text-neutral-500">{item.detail}</span>
              </Link>
            </li>
          )) : <li className="text-sm text-neutral-500">暂无热度数据。</li>}
        </ul>
      </div>
    </div>
  )
}

function CommentsContent({ card }: { card: DashboardCard }) {
  const items = card.insights ?? []

  return (
    <div className="grid h-full gap-4 sm:grid-cols-2">
      {items.map((item, index) => (
        <Link key={item.label} href={item.href} className={`${index > 0 ? 'border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0' : ''} flex flex-col justify-end rounded-lg transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:hover:text-blue-300`}>
          <i className={`${card.icon} text-neutral-400`} aria-hidden="true" />
          <span className="mt-5 text-3xl font-semibold tracking-tight">{item.value}</span>
          <span className="mt-1 text-sm text-neutral-500">{item.label}</span>
        </Link>
      ))}
    </div>
  )
}

function CreateArticleContent({ card }: { card: DashboardCard }) {
  return (
    <div className="flex h-full flex-col justify-between">
      <span className="grid size-10 place-items-center rounded-full bg-white/10 text-white dark:bg-neutral-900 dark:text-neutral-100">
        <i className={`${card.icon} text-sm`} aria-hidden="true" />
      </span>
      <p className="text-2xl font-semibold tracking-tight">{card.label}</p>
    </div>
  )
}

function SiteAnalyticsContent({ card, size }: { card: DashboardCard; size: DashboardCardSize }) {
  if (size === '1x1') {
    return <MetricLink card={card} />
  }

  return (
    <div className="flex h-full flex-col">
      <Link href={card.href} className="block rounded-lg transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:hover:text-blue-300">
        <MiniLineChart points={card.trend ?? []} />
      </Link>
      {size === '2x2' && (
        <div className="mt-auto grid gap-3 border-t border-neutral-200 pt-5 dark:border-neutral-800 sm:grid-cols-2">
          {(card.insights ?? []).map((item) => (
            <Link key={item.label} href={item.href} className="rounded-lg bg-neutral-50 px-3 py-2.5 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:bg-neutral-900 dark:hover:bg-neutral-800">
              <span className="text-xs text-neutral-500">{item.label}</span>
              <span className="mt-1 block truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{item.value}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function DashboardCardContent({ card, size, kind }: { card: DashboardCard; size: DashboardCardSize; kind: DashboardCardKind }) {
  if (kind === 'articleHeat') return <ArticleHeatContent card={card} size={size} />
  if (kind === 'comments') return <CommentsContent card={card} />
  if (kind === 'create') return <CreateArticleContent card={card} />
  if (kind === 'siteAnalytics') return <SiteAnalyticsContent card={card} size={size} />
  return <SummaryCardContent card={card} size={size} />
}

function DashboardStatCard({
  card,
  size,
  kind,
  action,
  dragging,
  dropTarget,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onAction,
  onSizeChange,
}: {
  card: DashboardCard
  size: DashboardCardSize
  kind: DashboardCardKind
  action?: 'add' | 'remove'
  dragging?: boolean
  dropTarget?: boolean
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
  const cardClassName = `dashboard-card relative h-full rounded-xl border border-neutral-200 bg-white p-5 transition-[border-color,box-shadow,transform,opacity] duration-200 ease-out dark:border-neutral-800 dark:bg-neutral-950 ${DASHBOARD_CARD_SIZE_CLASSES[size]} ${kind === 'create' ? 'border-neutral-950 bg-neutral-950 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging ? 'scale-[0.98] opacity-45 shadow-xl' : ''} ${dropTarget ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-50 dark:ring-blue-400 dark:ring-offset-neutral-900' : ''}`
  const cardContent = (
    <>
      {hasTopRightControls && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
          {onSizeChange && (
            <label className="relative" onPointerDown={(event) => event.stopPropagation()}>
              <span className="sr-only">选择“{card.label}”的卡片尺寸</span>
              <select
                value={size}
                aria-label={`选择“${card.label}”的卡片尺寸`}
                onChange={(event) => onSizeChange(event.target.value as DashboardCardSize)}
                className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-600 outline-none transition-colors hover:border-neutral-300 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600 dark:focus:border-neutral-400 dark:focus:ring-neutral-800"
              >
                {getDashboardCardConfig(card.key).allowedSizes.map((option) => (
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
      <DashboardCardContent card={card} size={size} kind={kind} />
    </>
  )

  if (!draggable && !action && kind === 'create') {
    return (
      <Link
        href={card.href}
        className={`${cardClassName} block text-left hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950`}
        aria-label={card.label}
      >
        {cardContent}
      </Link>
    )
  }

  return (
    <section
      draggable={draggable}
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
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null)
  const draggingKeyRef = useRef<string | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const positionsRef = useRef(new Map<string, DOMRect>())
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const cardMap = useMemo(() => new Map(cards.map((card) => [card.key, card])), [cards])
  const orderedCards = layout
    .filter((item) => item.visible)
    .map((item) => cardMap.get(item.key))
    .filter((card): card is DashboardCard => Boolean(card))
  const hiddenCards = cards.filter((card) => layout.find((item) => item.key === card.key)?.visible === false)

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const previousPositions = positionsRef.current
    const nextPositions = new Map<string, DOMRect>()

    for (const element of Array.from(grid.querySelectorAll<HTMLElement>('[data-card-key]'))) {
      const key = element.dataset.cardKey
      if (!key) continue

      const nextRect = element.getBoundingClientRect()
      const previousRect = previousPositions.get(key)
      nextPositions.set(key, nextRect)

      if (!previousRect || draggingKey === key) continue

      const deltaX = previousRect.left - nextRect.left
      const deltaY = previousRect.top - nextRect.top

      if (!deltaX && !deltaY) continue

      element.animate([
        { transform: `translate(${deltaX}px, ${deltaY}px)` },
        { transform: 'translate(0, 0)' },
      ], {
        duration: 220,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
      })
    }

    positionsRef.current = nextPositions
  }, [draggingKey, layout])

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
    const config = getDashboardCardConfig(card.key)
    const size = item?.size ?? config.defaultSize

    return (
      <div key={card.key} data-card-key={card.key} className={DASHBOARD_CARD_SIZE_CLASSES[size]}>
        <DashboardStatCard
          card={card}
          size={size}
          kind={config.kind}
          action={isManaging ? 'remove' : undefined}
          dragging={draggingKey === card.key}
          dropTarget={dropTargetKey === card.key && draggingKey !== card.key}
          draggable={isManaging}
          onSizeChange={isManaging && item && config.allowedSizes.length > 1 ? (nextSize) => setCardSize(card.key, nextSize) : undefined}
          onDragStart={(event) => {
            draggingKeyRef.current = card.key
            setDraggingKey(card.key)
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', card.key)
          }}
          onDragOver={(event) => {
            if (!isManaging) return

            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDropTargetKey(card.key)
          }}
          onDrop={(event) => {
            if (!isManaging) return

            event.preventDefault()
            const sourceKey = event.dataTransfer.getData('text/plain') || draggingKeyRef.current
            if (sourceKey) {
              moveCard(sourceKey, card.key)
            }
            draggingKeyRef.current = null
            setDraggingKey(null)
            setDropTargetKey(null)
          }}
          onDragEnd={() => {
            draggingKeyRef.current = null
            setDraggingKey(null)
            setDropTargetKey(null)
          }}
          onAction={() => setCardVisibility(card.key, false)}
        />
      </div>
    )
  }

  function renderHiddenCard(card: DashboardCard) {
    const config = getDashboardCardConfig(card.key)

    return (
      <DashboardStatCard
        key={card.key}
        card={card}
        size={config.defaultSize}
        kind={config.kind}
        action="add"
        onAction={() => setCardVisibility(card.key, true)}
      />
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        {isManaging && <p className="mr-auto text-sm text-neutral-500">当前显示 {orderedCards.length} / {cards.length} 张卡片。拖动卡片可调整顺序。</p>}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-neutral-500" aria-live="polite">{isPending ? '正在自动保存…' : message}</span>
          <button
            type="button"
            onClick={() => setIsManaging((value) => !value)}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            aria-expanded={isManaging}
          >
            <i className={`fa-solid ${isManaging ? 'fa-xmark' : 'fa-sliders'} text-xs`} aria-hidden="true" />
            {isManaging ? '退出管理' : '管理卡片'}
          </button>
        </div>
      </div>

      {orderedCards.length > 0 ? (
        <div ref={gridRef} className="grid auto-rows-40 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={isManaging ? '当前显示卡片' : undefined}>
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
            <span className="text-sm text-neutral-500">按默认规格展示，添加后可参与排序</span>
          </div>
          {hiddenCards.length > 0 ? (
            <div className="grid auto-rows-40 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {hiddenCards.map(renderHiddenCard)}
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
