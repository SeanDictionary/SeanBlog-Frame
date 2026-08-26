'use client'

import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import type { AnalyticsTrendPoint } from '@/lib/services/analytics-service'

export type AnalyticsGranularityOption = {
  value: string
  label: string
  href: Route
}

type AnalyticsTrendChartProps = {
  title?: string
  description?: string
  trend: AnalyticsTrendPoint[]
  granularityOptions: AnalyticsGranularityOption[]
  currentGranularity?: string
  toolbar?: ReactNode
  bare?: boolean
}

const WIDTH = 820
const HEIGHT = 300
const PAD = { top: 22, right: 24, bottom: 44, left: 52 }
const PLOT_W = WIDTH - PAD.left - PAD.right
const PLOT_H = HEIGHT - PAD.top - PAD.bottom
const MAX_POINT_SPACING = 150
const AXIS_FONT = 13
const TOOLTIP_WIDTH = 148
const TOOLTIP_GAP = 16

type HoverState = {
  index: number
  px: number
  topPy: number
  bottomPy: number
  boxW: number
  boxH: number
}

function formatNumber(value: number) {
  return value.toLocaleString('zh-CN')
}

function shortDateLabel(date: string) {
  return date.length === 7 ? date : date.slice(5)
}

function niceTicks(rawMax: number, targetCount = 5) {
  const max = Math.max(1, rawMax)
  const roughStep = max / targetCount
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
  const normalized = roughStep / magnitude
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  let step = niceNormalized * magnitude
  if (step < 1) step = 1
  const niceMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let value = 0; value <= niceMax + step * 0.5; value += step) {
    ticks.push(value)
  }
  return { max: niceMax, ticks }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function AnalyticsTrendChart({
  title,
  description,
  trend,
  granularityOptions,
  currentGranularity,
  toolbar,
  bare = false,
}: AnalyticsTrendChartProps) {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const tipRef = useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = useState<HoverState | null>(null)
  const [tipHeight, setTipHeight] = useState(72)

  // Measure the real tooltip height so the above/below decision is accurate;
  // the gap itself is exact because we position with bottom/top, not top+height.
  useLayoutEffect(() => {
    if (tipRef.current) {
      const height = tipRef.current.offsetHeight
      if (height && height !== tipHeight) setTipHeight(height)
    }
  }, [tipHeight, hover])

  const pointCount = trend.length
  const rawMax = Math.max(1, ...trend.flatMap((point) => [point.views, point.visitors]))
  const { max: maxValue, ticks } = niceTicks(rawMax, 5)

  const naturalSpacing = pointCount > 1 ? PLOT_W / (pointCount - 1) : 0
  const spacing = Math.min(naturalSpacing, MAX_POINT_SPACING)
  const dataWidth = pointCount > 1 ? spacing * (pointCount - 1) : 0
  const dataOffset = (PLOT_W - dataWidth) / 2

  const xOf = (index: number) =>
    pointCount > 1
      ? PAD.left + dataOffset + index * spacing
      : PAD.left + PLOT_W / 2
  const yOf = (value: number) => PAD.top + PLOT_H - (value / maxValue) * PLOT_H

  const buildPath = (key: 'views' | 'visitors') =>
    pointCount > 1
      ? trend
          .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xOf(index).toFixed(2)} ${yOf(point[key]).toFixed(2)}`)
          .join(' ')
      : ''

  const viewsPath = buildPath('views')
  const visitorsPath = buildPath('visitors')

  const maxLabels = 6
  const labelStep = pointCount > maxLabels ? Math.ceil(pointCount / maxLabels) : 1
  const xTickIndices: number[] = []
  for (let index = 0; index < pointCount; index += labelStep) {
    xTickIndices.push(index)
  }
  if (xTickIndices[xTickIndices.length - 1] !== pointCount - 1 && pointCount > 0) {
    xTickIndices.push(pointCount - 1)
  }

  const columnWidth = pointCount > 1 ? spacing : PLOT_W
  const hoverIndex = hover?.index ?? null
  const hoveredPoint = hover && hover.index < pointCount ? trend[hover.index] : null

  function handleEnter(index: number) {
    const svg = svgRef.current
    if (!svg) return
    const box = svg.getBoundingClientRect()
    if (!box.width || !box.height) return
    const scale = box.width / WIDTH
    const point = trend[index]
    const px = xOf(index) * scale
    const topPy = Math.min(yOf(point.views), yOf(point.visitors)) * scale
    const bottomPy = Math.max(yOf(point.views), yOf(point.visitors)) * scale
    setHover({ index, px, topPy, bottomPy, boxW: box.width, boxH: box.height })
  }

  // Position the tooltip with bottom (above) or top (below) so the gap to
  // the data point is always TOOLTIP_GAP regardless of the tooltip's height.
  let tooltipLeft = 0
  let tooltipVertical: { bottom?: number; top?: number } = {}
  let tooltipAbove = true
  if (hover) {
    tooltipLeft = clamp(hover.px - TOOLTIP_WIDTH / 2, 4, hover.boxW - TOOLTIP_WIDTH - 4)
    const aboveFits = hover.topPy - TOOLTIP_GAP - tipHeight >= 4
    const belowFits = hover.bottomPy + TOOLTIP_GAP + tipHeight <= hover.boxH - 4
    const moreRoomAbove = hover.topPy >= hover.boxH - hover.bottomPy
    const placeAbove = aboveFits || (!belowFits && moreRoomAbove)
    tooltipAbove = placeAbove
    tooltipVertical = placeAbove
      ? { bottom: hover.boxH - hover.topPy + TOOLTIP_GAP }
      : { top: hover.bottomPy + TOOLTIP_GAP }
  }

  function handleGranularityClick(event: React.MouseEvent<HTMLAnchorElement>, href: Route) {
    event.preventDefault()
    router.push(href)
  }

  const content = (
    <>
      <style>{`
        @keyframes analytics-trend-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes analytics-trend-fade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      {(title || description || toolbar) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
          </div>
          {toolbar ?? <div className="flex gap-4 text-xs text-neutral-500"><span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-blue-600" />访问量</span><span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-amber-600" />访客数</span></div>}
        </div>
      )}

      {pointCount === 0 ? (
        <div className="grid h-64 place-items-center text-sm text-neutral-500">暂无趋势数据。</div>
      ) : (
        <div className="relative" onMouseLeave={() => setHover(null)}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label="访问量和访客数趋势图"
            preserveAspectRatio="xMidYMid meet"
            className="w-full"
            style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
          >
            {/* horizontal gridlines extending from each y-axis tick */}
            {ticks.map((tick) => {
              const y = yOf(tick)
              return (
                <line
                  key={`hgrid-${tick}`}
                  x1={PAD.left}
                  x2={PAD.left + PLOT_W}
                  y1={y}
                  y2={y}
                  className="stroke-neutral-200 dark:stroke-neutral-800"
                  strokeDasharray="3 4"
                  strokeWidth={1}
                />
              )
            })}

            {/* y-axis ticks + labels */}
            {ticks.map((tick) => {
              const y = yOf(tick)
              return (
                <g key={`ytick-${tick}`}>
                  <line x1={PAD.left - 6} x2={PAD.left} y1={y} y2={y} className="stroke-neutral-300 dark:stroke-neutral-700" strokeWidth={1} />
                  <text x={PAD.left - 9} y={y + 4} textAnchor="end" className="fill-neutral-500" fontSize={AXIS_FONT}>{formatNumber(tick)}</text>
                </g>
              )
            })}

            {/* axes */}
            <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={PAD.top + PLOT_H} y2={PAD.top + PLOT_H} className="stroke-neutral-300 dark:stroke-neutral-700" strokeWidth={1} />
            <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + PLOT_H} className="stroke-neutral-300 dark:stroke-neutral-700" strokeWidth={1} />

            {/* x tick labels */}
            {xTickIndices.map((index) => (
              <text key={`x-${index}`} x={xOf(index)} y={PAD.top + PLOT_H + 20} textAnchor="middle" className="fill-neutral-500" fontSize={AXIS_FONT}>
                {shortDateLabel(trend[index].date)}
              </text>
            ))}

            {/* hover column highlight */}
            <line
              x1={xOf(hoverIndex ?? 0)}
              x2={xOf(hoverIndex ?? 0)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              className="stroke-blue-500/60 dark:stroke-blue-400/60"
              strokeWidth={1}
              style={{ opacity: hoverIndex !== null ? 1 : 0, transition: 'opacity 0.15s ease' }}
            />

            {/* trend lines */}
            {pointCount > 1 && (
              <>
                <path
                  key={`views-${currentGranularity}`}
                  d={viewsPath}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  style={{ strokeDasharray: 1, animation: 'analytics-trend-draw 0.6s cubic-bezier(0.2, 0, 0, 1)' }}
                />
                <path
                  key={`visitors-${currentGranularity}`}
                  d={visitorsPath}
                  fill="none"
                  stroke="#d97706"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="6 6"
                  style={{ animation: 'analytics-trend-fade 0.6s ease' }}
                />
              </>
            )}

            {/* points: only show on the hovered column or single-point case */}
            {pointCount === 1 ? (
              <g key={`points-${currentGranularity}`} style={{ animation: 'analytics-trend-fade 0.6s ease' }}>
                {trend.map((point, index) => (
                  <g key={`pt-${index}`}>
                    <circle cx={xOf(index)} cy={yOf(point.visitors)} r={5} fill="#d97706" />
                    <circle cx={xOf(index)} cy={yOf(point.views)} r={5} fill="#2563eb" />
                  </g>
                ))}
              </g>
            ) : (
              hoveredPoint && hoverIndex !== null && (
                <g key={`points-hover`}>
                  <circle cx={xOf(hoverIndex)} cy={yOf(hoveredPoint.visitors)} r={4} fill="#d97706" style={{ transition: 'opacity 0.15s ease' }} />
                  <circle cx={xOf(hoverIndex)} cy={yOf(hoveredPoint.views)} r={4} fill="#2563eb" style={{ transition: 'opacity 0.15s ease' }} />
                </g>
              )
            )}

            {/* invisible hover columns */}
            {trend.map((point, index) => (
              <rect
                key={`hit-${index}`}
                x={xOf(index) - columnWidth / 2}
                y={PAD.top}
                width={columnWidth}
                height={PLOT_H}
                fill="transparent"
                onMouseEnter={() => handleEnter(index)}
              />
            ))}
          </svg>

          {/* HTML tooltip overlay (not clipped by the SVG) */}
          {hover && hoveredPoint && (
            <div
              ref={tipRef}
              className="pointer-events-none absolute z-10 rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg dark:border-white/10 dark:bg-neutral-800"
              style={{ left: tooltipLeft, width: TOOLTIP_WIDTH, ...tooltipVertical, transition: 'opacity 0.15s ease, top 0.12s ease, left 0.12s ease, bottom 0.12s ease' }}
            >
              <p className="font-semibold">{shortDateLabel(hoveredPoint.date)}</p>
              <p className="mt-1 flex items-center gap-1.5"><span className="size-2 rounded-full bg-blue-600" />访问量 {formatNumber(hoveredPoint.views)}</p>
              <p className="mt-0.5 flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-600" />访客数 {formatNumber(hoveredPoint.visitors)}</p>
              <span className={`absolute h-2 w-2 rotate-45 bg-neutral-900 dark:bg-neutral-800 ${tooltipAbove ? 'bottom-[-4px]' : 'top-[-4px]'}`} style={{ left: clamp(hover.px - tooltipLeft - 4, 4, TOOLTIP_WIDTH - 12) }} />
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-blue-600" />访问量</span>
          <span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-amber-600" />访客数</span>
        </div>
        {granularityOptions.length > 0 && (
          <div className="flex items-center gap-0.5 rounded-md border border-neutral-200 p-0.5 text-xs dark:border-neutral-800">
            {granularityOptions.map((option) => {
              const active = option.value === currentGranularity
              return (
                <a
                  key={option.value}
                  href={option.href}
                  onClick={(event) => handleGranularityClick(event, option.href)}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    active
                      ? 'bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  {option.label}
                </a>
              )
            })}
          </div>
        )}
      </div>
    </>
  )

  if (bare) return content

  return <Card>{content}</Card>
}
