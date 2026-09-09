'use client'

import { useEffect, useId, useRef, useState } from 'react'

import type { AnalyticsStatsField } from '@/lib/services/analytics-service'

type FieldStatsDialogProps = {
  field: AnalyticsStatsField
  title: string
  start?: string
  end?: string
  rangeLabel: string
  onClose: () => void
}

type StatsRow = { label: string; count: number }
type StatsData = { items: StatsRow[]; total: number; crawlerCount: number }

function formatPercent(count: number, total: number) {
  if (total <= 0) return '0%'
  const pct = (count / total) * 100
  if (pct > 0 && pct < 0.1) return '<0.1%'
  return `${pct.toFixed(1)}%`
}

/** 访问来源字段分布弹窗。on mount 懒取 /api/admin/analytics/field-stats。 */
export function FieldStatsDialog({ field, title, start, end, rangeLabel, onClose }: FieldStatsDialogProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const [data, setData] = useState<StatsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    params.set('field', field)
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    fetch(`/api/admin/analytics/field-stats?${params.toString()}`, { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const json = (await response.json()) as StatsData
        if (!cancelled) setData(json)
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => {
      cancelled = true
    }
  }, [field, start, end])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    closeRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">{title}</h2>
            <p className="mt-1 text-sm text-neutral-500">统计范围：{rangeLabel}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-md bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 dark:bg-neutral-100 dark:text-neutral-950">关闭</button>
        </div>
        {error ? (
          <p className="py-10 text-center text-sm text-red-600 dark:text-red-400">加载失败：{error}</p>
        ) : data === null ? (
          <p className="py-10 text-center text-sm text-neutral-500">加载中…</p>
        ) : data.items.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">暂无统计数据。</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-100 text-xs text-neutral-500 dark:border-neutral-900">
              <tr>
                <th className="py-2 pr-4">统计值</th>
                <th className="py-2 pr-4 text-right">计数 / 合计</th>
                <th className="py-2 pr-2 text-right">百分占比</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {data.items.map((item) => (
                <tr key={item.label}>
                  <td className="py-2.5 pr-4 font-medium">{item.label}</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-xs">{item.count} / {data.total}</td>
                  <td className="py-2.5 pr-2 text-right font-mono text-xs">{formatPercent(item.count, data.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && data.crawlerCount > 0 && (
          <p className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500 dark:border-neutral-900">爬虫 {data.crawlerCount} 条（不计入合计）</p>
        )}
      </div>
    </div>
  )
}

/** 由 start/end 字符串构建"统计范围"副标题文案。 */
export function buildRangeLabel(start?: string, end?: string): string {
  if (start && end) return `${start} 至 ${end}`
  if (start) return `${start} 至今`
  if (end) return `截至 ${end}`
  return '有史以来'
}
