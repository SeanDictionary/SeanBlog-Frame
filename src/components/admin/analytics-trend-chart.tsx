'use client'

import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'

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
}

const WIDTH = 820
const HEIGHT = 300
const PAD = { top: 22, right: 24, bottom: 44, left: 52 }
const PLOT_W = WIDTH - PAD.left - PAD.right
const PLOT_H = HEIGHT - PAD.top - PAD.bottom
// Cap how far apart two adjacent samples can sit so a sparse chart does not
// stretch its line from one card edge to the other; the cluster is centered.
const MAX_POINT_SPACING = 150
const AXIS_FONT = 13
const TOOLTIP_FONT = 12

function formatNumber(value: number) {
  return value.toLocaleString('zh-CN')
}

function shortDateLabel(date: string) {
  // day/week come in as YYYY-MM-DD, month as YYYY-MM.
  return date.length === 7 ? date : date.slice(5)
}

// Pick round y-axis ticks (10 / 20 / 50 / 100 / 500 ...) based on the data
// so labels read as clean tens, fifties, hundreds instead of arbitrary
// divisions of the max. Returns the nice ceiling the chart scales to.
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

export function AnalyticsTrendChart({
  title,
  description,
  trend,
  granularityOptions,
  currentGranularity,
  toolbar,
}: AnalyticsTrendChartProps) {
  const router = useRouter()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const pointCount = trend.length
  const rawMax = Math.max(1, ...trend.flatMap((point) => [point.views, point.visitors]))
  const { max: maxValue, ticks } = niceTicks(rawMax, 5)
  const yOf = (value: number) => PAD.top + PLOT_H - (value / maxValue) * PLOT_H

  const naturalSpacing = pointCount > 1 ? PLOT_W / (pointCount - 1) : 0
  const spacing = Math.min(naturalSpacing, MAX_POINT_SPACING)
  const dataWidth = pointCount > 1 ? spacing * (pointCount - 1) : 0
  const dataOffset = (PLOT_W - dataWidth) / 2

  const xOf = (index: number) =>
    pointCount > 1
      ? PAD.left + dataOffset + index * spacing
      : PAD.left + PLOT_W / 2


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
  const activeIndex = hoverIndex ?? 0
  const hovered = hoverIndex !== null ? trend[hoverIndex] : null

  const tooltipWidth = 138
  const tooltipHeight = 64
  let tooltipX = PAD.left
  const tooltipY = PAD.top
  if (hovered && hoverIndex !== null) {
    const pointX = xOf(hoverIndex)
    tooltipX = Math.min(
      Math.max(pointX - tooltipWidth / 2, PAD.left + 2),
      PAD.left + PLOT_W - tooltipWidth - 2,
    )
  }

  function handleGranularityClick(event: React.MouseEvent<HTMLAnchorElement>, href: Route) {
    event.preventDefault()
    router.push(href)
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
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
        <div className="grid h-64 place-items-center rounded-md bg-neutral-50 text-sm text-neutral-500 dark:bg-neutral-900">暂无趋势数据。</div>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="访问量和访客数趋势图"
          preserveAspectRatio="xMidYMid meet"
          className="w-full rounded-md bg-neutral-50 dark:bg-neutral-900"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
          onMouseLeave={() => setHoverIndex(null)}
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

          {/* axes: keep the x-axis line spanning the full plot width; only the data points are centered */}
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
            x1={xOf(activeIndex)}
            x2={xOf(activeIndex)}
            y1={PAD.top}
            y2={PAD.top + PLOT_H}
            className="stroke-blue-500/60 dark:stroke-blue-400/60"
            strokeWidth={1}
            style={{ opacity: hoverIndex !== null ? 1 : 0, transition: 'opacity 0.15s ease' }}
          />

          {/* trend lines (remount on granularity change to replay the draw/fade animation) */}
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

          {/* points (also covers the single-point case where no line can form) */}
          <g key={`points-${currentGranularity}`} style={{ animation: 'analytics-trend-fade 0.6s ease' }}>
            {trend.map((point, index) => (
              <g key={`pt-${index}`}>
                <circle cx={xOf(index)} cy={yOf(point.visitors)} r={pointCount === 1 ? 5 : 3} fill="#d97706" />
                <circle cx={xOf(index)} cy={yOf(point.views)} r={pointCount === 1 ? 5 : 3} fill="#2563eb" />
              </g>
            ))}
          </g>

          {/* hovered point halo */}
          {hovered && hoverIndex !== null && (
            <>
              <circle cx={xOf(hoverIndex)} cy={yOf(hovered.visitors)} r={7} fill="#d97706" style={{ opacity: 0.25, transition: 'opacity 0.15s ease' }} />
              <circle cx={xOf(hoverIndex)} cy={yOf(hovered.views)} r={7} fill="#2563eb" style={{ opacity: 0.25, transition: 'opacity 0.15s ease' }} />
            </>
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
              onMouseEnter={() => setHoverIndex(index)}
            />
          ))}

          {/* tooltip */}
          {hovered && hoverIndex !== null && (
            <g pointerEvents="none" style={{ opacity: hoverIndex !== null ? 1 : 0, transition: 'opacity 0.15s ease' }}>
              <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx={6} className="fill-neutral-900/95 dark:fill-neutral-100/95" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
              <circle cx={tooltipX + 12} cy={tooltipY + 18} r={3.5} fill="#2563eb" />
              <text x={tooltipX + 23} y={tooltipY + 22} className="fill-neutral-100 dark:fill-neutral-900" fontSize={TOOLTIP_FONT} fontWeight={600}>{shortDateLabel(hovered.date)}</text>
              <circle cx={tooltipX + 12} cy={tooltipY + 37} r={3.5} fill="#2563eb" />
              <text x={tooltipX + 23} y={tooltipY + 41} className="fill-neutral-100 dark:fill-neutral-900" fontSize={TOOLTIP_FONT}>访问量 {formatNumber(hovered.views)}</text>
              <circle cx={tooltipX + 12} cy={tooltipY + 56} r={3.5} fill="#d97706" />
              <text x={tooltipX + 23} y={tooltipY + 60} className="fill-neutral-100 dark:fill-neutral-900" fontSize={TOOLTIP_FONT}>访客数 {formatNumber(hovered.visitors)}</text>
            </g>
          )}
        </svg>
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
    </section>
  )
}
