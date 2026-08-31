'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import { ExternalLink } from '@/components/common/external-link'
import type { AnalyticsVisitRecord } from '@/lib/services/analytics-service'

import { formatDateTime, formatDurationShort, formatDurationFull } from '@/lib/format'

function isExternalUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

function contentHref(visit: AnalyticsVisitRecord): Route {
  if (visit.contentType === 'article' && visit.contentSlug) return `/articles/${visit.contentSlug}` as Route
  if (visit.contentType === 'category' && visit.contentSlug) return `/categories/${visit.contentSlug}` as Route
  if (visit.contentType === 'tag' && visit.contentSlug) return `/tags/${visit.contentSlug}` as Route
  return visit.path as Route
}

function referrerLabel(value: string | null) {
  if (value === null) return '未采集'
  if (value === '') return '直接访问'
  return value
}

// The fingerprint and hardware fields are stored as JSON objects (a single
// string column). Parse them here and map keys to Chinese labels so the
// detail dialog can spell out each component instead of showing the raw
// delimited string.
const FINGERPRINT_LABELS: Record<string, string> = {
  language: '语言',
  timezone: '时区',
  screenWidth: '屏幕宽度',
  screenHeight: '屏幕高度',
  devicePixelRatio: '像素比',
}

const HARDWARE_LABELS: Record<string, string> = {
  cores: 'CPU 核心数',
  memory: '内存',
  gpu: '显卡',
}

function toDetailParts(
  value: string | null,
  labels: Record<string, string>,
  format: (key: string, value: unknown) => string = (_key, val) => `${val}`,
): Array<{ label: string; value: string }> | null {
  if (!value) return null
  try {
    const data = JSON.parse(value) as Record<string, unknown>
    const entries = Object.entries(data)
      .filter(([key]) => key in labels)
      .map(([key, val]) => ({ label: labels[key], value: format(key, val) }))
    return entries.length ? entries : null
  } catch {
    return null
  }
}

function VisitDetailDialog({ visit, onClose }: { visit: AnalyticsVisitRecord; onClose: () => void }) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    closeRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const fingerprint = toDetailParts(visit.browserFingerprint, FINGERPRINT_LABELS)
  const hardware = toDetailParts(visit.hardware, HARDWARE_LABELS, (key, val) => key === 'memory' ? `${val} GB` : `${val}`)
  const fieldClass = 'grid grid-cols-[8rem_1fr] gap-2 py-2.5 border-b border-neutral-100 dark:border-neutral-900'
  const labelClass = 'text-sm text-neutral-500'
  const valueClass = 'min-w-0 break-all text-sm text-neutral-800 dark:text-neutral-100'

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
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">访问详情</h2>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-md bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 dark:bg-neutral-100 dark:text-neutral-950">关闭</button>
        </div>
        <dl className="divide-y divide-neutral-100 dark:divide-neutral-900">
          <div className={fieldClass}><dt className={labelClass}>访问时间</dt><dd className={valueClass}>{formatDateTime(visit.createdAt)}</dd></div>
          <div className={fieldClass}><dt className={labelClass}>访问时长</dt><dd className={valueClass}>{formatDurationFull(visit.durationSeconds)}</dd></div>
          <div className={fieldClass}><dt className={labelClass}>访客 ID</dt><dd className={valueClass}>{visit.visitorId ? <Link href={`/admin/visitors/${visit.visitorId}` as Route} className="font-mono text-xs hover:underline cursor-pointer">{visit.visitorId}</Link> : <span className="font-mono text-xs">未采集</span>}</dd></div>
          <div className={fieldClass}><dt className={labelClass}>内容类型</dt><dd className={valueClass}>{visit.contentType}</dd></div>
          <div className={fieldClass}><dt className={labelClass}>访问内容</dt><dd className={valueClass}><Link href={contentHref(visit)} className="font-medium">{visit.contentLabel}</Link><p className="mt-1 flex items-center gap-2 font-mono text-xs text-neutral-500"><span className="break-all">{visit.path}</span><a href={contentHref(visit) as string} target="_blank" rel="noreferrer" className="shrink-0 text-neutral-400 transition-colors hover:text-neutral-950 dark:hover:text-neutral-50" aria-label="在新窗口打开"><i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /></a></p></dd></div>
          <div className={fieldClass}><dt className={labelClass}>地区</dt><dd className={valueClass}>{visit.country ?? '未知'}</dd></div>
          <div className={fieldClass}><dt className={labelClass}>IP</dt><dd className={`font-mono text-xs ${valueClass}`}>{visit.ipAddress ?? '未采集'}</dd></div>
          <div className={fieldClass}><dt className={labelClass}>系统</dt><dd className={valueClass}>{visit.operatingSystem}</dd></div>
          <div className={fieldClass}><dt className={labelClass}>浏览器</dt><dd className={valueClass}>{visit.browser}</dd></div>
          <div className={fieldClass}><dt className={labelClass}>User-Agent</dt><dd className={`font-mono text-xs ${valueClass}`}>{visit.userAgent ?? '未采集'}</dd></div>
          <div className={fieldClass}><dt className={labelClass}>来源 URL</dt><dd className={valueClass}>{isExternalUrl(visit.referrer) ? <ExternalLink href={visit.referrer} className="font-medium text-neutral-800 transition-colors hover:text-blue-600 dark:text-neutral-100 dark:hover:text-blue-300">{visit.referrer}</ExternalLink> : <span>{referrerLabel(visit.referrer)}</span>}</dd></div>
          <div className={fieldClass}><dt className={labelClass}>浏览器指纹</dt><dd className={valueClass}>{fingerprint ? <ul className="space-y-0.5">{fingerprint.map((part) => <li key={part.label} className="flex justify-between gap-3"><span className="text-neutral-500">{part.label}</span><span className="font-mono">{part.value}</span></li>)}</ul> : <span>未采集</span>}</dd></div>
          <div className={fieldClass}><dt className={labelClass}>硬件信息</dt><dd className={valueClass}>{hardware ? <ul className="space-y-0.5">{hardware.map((part) => <li key={part.label} className="flex justify-between gap-3"><span className="text-neutral-500">{part.label}</span><span className="font-mono">{part.value}</span></li>)}</ul> : <span>未采集</span>}</dd></div>
        </dl>
      </div>
    </div>
  )
}

export function VisitRecordTable({ visits, tiny = false }: { visits: AnalyticsVisitRecord[]; tiny?: boolean }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeVisit = visits.find((visit) => visit.id === activeId) ?? null

  return (
    <>
      <div className="overflow-x-auto -mx-5">
        <table className={`w-full text-left text-sm ${!tiny && 'min-w-5xl'}`}>
          <thead className="border-b border-neutral-100 text-xs text-neutral-500 dark:border-neutral-900">
            <tr>
              {tiny ? (
                <>
                  <th className="py-2 pl-5 pr-4">访问时间</th>
                  <th className="py-2 pr-4">访问时长</th>
                  <th className="py-2 pr-4">访问内容</th>
                  <th className="py-2 pr-5">来源 URL</th>
                </>
              ) : (
                <>
                  <th className="py-2 pl-5 pr-4">访问时间</th>
                  <th className="py-2 pr-4">访问时长</th>
                  <th className="py-2 pr-4">访问内容</th>
                  <th className="py-2 pr-4">地区 / IP</th>
                  <th className="py-2 pr-4">系统</th>
                  <th className="py-2 pr-4">浏览器</th>
                  <th className="py-2 pr-5">来源 URL</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {visits.map((visit) => (
              <tr
                key={visit.id}
                onClick={() => setActiveId(visit.id)}
                className={`cursor-pointer transition-colors ${activeId === visit.id ? 'bg-blue-50/70 dark:bg-blue-950/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60'}`}
              >
                <td className="py-3 pl-5 pr-4 font-mono text-xs">{formatDateTime(visit.createdAt)}</td>
                <td className="py-3 pr-4">{formatDurationShort(visit.durationSeconds)}</td>
                <td className="py-3 pr-4"><Link href={contentHref(visit)} onClick={(event) => event.stopPropagation()} className="block max-w-52 truncate font-medium hover:text-blue-600">{visit.contentLabel}</Link><p className="mt-0.5 flex items-center gap-2 font-mono text-xs text-neutral-500"><span className="max-w-48 truncate">{visit.contentSlug ?? visit.path}</span><a href={contentHref(visit) as string} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="shrink-0 text-neutral-400 transition-colors hover:text-neutral-950 dark:hover:text-neutral-50" aria-label="在新窗口打开"><i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /></a></p></td>
                {tiny ? null : (
                  <>
                    <td className="py-3 pr-4"><span className="block">{visit.country ?? '未知'}</span><span className="mt-0.5 block font-mono text-xs text-neutral-500">{visit.ipAddress ?? '未采集'}</span></td>
                    <td className="py-3 pr-4">{visit.operatingSystem}</td>
                    <td className="py-3 pr-4">{visit.browser}</td>
                  </>
                )}
                <td className="py-3 pr-5">{isExternalUrl(visit.referrer) ? <ExternalLink href={visit.referrer} className="block max-w-56 truncate text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">{visit.referrer}</ExternalLink> : <span className="block max-w-56 truncate text-neutral-500">{referrerLabel(visit.referrer)}</span>}</td>
              </tr>
            ))}
            {visits.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-neutral-500">暂无访问记录。</td></tr>}
          </tbody>
        </table>
      </div>
      {activeVisit && <VisitDetailDialog visit={activeVisit} onClose={() => setActiveId(null)} />}
    </>
  )
}
