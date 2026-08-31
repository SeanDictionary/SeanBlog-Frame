'use client'

import type { OperationLogResult } from '@prisma/client'
import { useEffect, useId, useRef, useState } from 'react'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/format'

type LogItem = {
  id: string
  createdAt: Date
  module: string
  action: string
  actorType: string
  actorName: string | null
  targetType: string | null
  targetId: string | null
  summary: string
  result: OperationLogResult
  errorCode: string | null
  errorMessage: string | null
  method: string | null
  path: string | null
  metadata: unknown
}

type LogsTableProps = {
  items: LogItem[]
}

const resultLabels = {
  SUCCESS: '成功',
  FAILURE: '失败',
} satisfies Record<OperationLogResult, string>

const resultBadgeTones: Record<OperationLogResult, BadgeTone> = {
  SUCCESS: 'green',
  FAILURE: 'red',
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

function formatMetadata(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function LogDetailDialog({ log, onClose }: { log: LogItem; onClose: () => void }) {
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

  const actorDisplay = log.actorName ?? (log.actorType === 'visitor' ? '访客' : '系统')
  const moduleAction = `${log.module}.${log.action}`

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">操作日志详情</h2>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-md bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 dark:bg-neutral-100 dark:text-neutral-950">
            关闭
          </button>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="grid grid-cols-[8rem_1fr] gap-2">
            <dt className="text-neutral-500">时间</dt>
            <dd className="font-mono text-xs text-neutral-800 dark:text-neutral-200">{formatDateTime(log.createdAt)}</dd>
          </div>

          <div className="grid grid-cols-[8rem_1fr] gap-2">
            <dt className="text-neutral-500">结果</dt>
            <dd><Badge tone={resultBadgeTones[log.result]}>{resultLabels[log.result]}</Badge></dd>
          </div>

          <div className="grid grid-cols-[8rem_1fr] gap-2">
            <dt className="text-neutral-500">模块 / 操作</dt>
            <dd className="font-mono text-xs text-neutral-800 dark:text-neutral-200">{moduleAction}</dd>
          </div>

          <div className="grid grid-cols-[8rem_1fr] gap-2">
            <dt className="text-neutral-500">操作人</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">
              {actorDisplay}
              {log.actorType && <span className="ml-1 text-neutral-500">({log.actorType})</span>}
            </dd>
          </div>

          <div className="grid grid-cols-[8rem_1fr] gap-2">
            <dt className="text-neutral-500">内容</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{log.summary}</dd>
          </div>

          {log.targetType && (
            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <dt className="text-neutral-500">目标</dt>
              <dd className="font-mono text-xs text-neutral-600 dark:text-neutral-400">
                {log.targetType}: {log.targetId ?? '-'}
              </dd>
            </div>
          )}

          {(log.method || log.path) && (
            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <dt className="text-neutral-500">请求</dt>
              <dd className="font-mono text-xs text-neutral-600 dark:text-neutral-400">
                {log.method && <span>{log.method}</span>}
                {log.method && log.path && <span className="mx-1">→</span>}
                {log.path && <span className="break-all">{log.path}</span>}
              </dd>
            </div>
          )}

          {log.errorMessage && (
            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <dt className="text-neutral-500">错误</dt>
              <dd>
                {log.errorCode && <p className="font-mono text-xs text-red-600 dark:text-red-400">{log.errorCode}</p>}
                <p className="mt-0.5 text-xs text-red-600 dark:text-red-300">{log.errorMessage}</p>
              </dd>
            </div>
          )}

          {log.metadata != null && (
            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <dt className="text-neutral-500">元数据</dt>
              <dd>
                <pre className="max-h-64 overflow-auto rounded bg-neutral-100 p-3 font-mono text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  {formatMetadata(log.metadata)}
                </pre>
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}

export function LogsTable({ items }: LogsTableProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeLog = items.find((item) => item.id === activeId) ?? null

  if (items.length === 0) {
    return <div className="py-10 text-center text-sm text-neutral-500">暂无操作日志。</div>
  }

  return (
    <>
      <div className="overflow-x-auto -mx-5">
        <table className="w-full min-w-5xl border-separate border-spacing-0 text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="whitespace-nowrap py-2 pl-5 pr-4 font-medium">时间</th>
              <th className="whitespace-nowrap py-2 pr-4 font-medium">结果</th>
              <th className="whitespace-nowrap py-2 pr-4 font-medium">模块 / 操作</th>
              <th className="whitespace-nowrap py-2 pr-4 font-medium">操作人</th>
              <th className="whitespace-nowrap py-2 pr-4 font-medium">内容</th>
              <th className="whitespace-nowrap py-2 pr-4 font-medium">错误</th>
              <th className="whitespace-nowrap py-2 pr-5 font-medium">请求</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {items.map((log) => {
              const actorDisplay = log.actorName ?? (log.actorType === 'visitor' ? '访客' : '系统')
              const moduleAction = `${log.module}.${log.action}`

              return (
                <tr
                  key={log.id}
                  onClick={() => setActiveId(log.id)}
                  className={`cursor-pointer transition-colors ${activeId === log.id ? 'bg-blue-50/70 dark:bg-blue-950/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60'}`}
                >
                  <td className="whitespace-nowrap py-3 pl-5 pr-4 font-mono text-xs text-neutral-500">{formatDateTime(log.createdAt)}</td>
                  <td className="whitespace-nowrap py-3 pr-4"><Badge tone={resultBadgeTones[log.result]}>{resultLabels[log.result]}</Badge></td>
                  <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs text-neutral-600 dark:text-neutral-400">{moduleAction}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-xs">
                    <span>{actorDisplay}</span>
                    {log.actorType && <span className="ml-1 text-neutral-400">({log.actorType})</span>}
                  </td>
                  <td className="py-3 pr-4">
                    <p className="truncate text-neutral-800 dark:text-neutral-200" title={log.summary}>{log.summary}</p>
                    {log.targetType && (
                      <p className="mt-0.5 font-mono text-xs text-neutral-500 truncate" title={`${log.targetType}: ${log.targetId ?? '-'}`}>
                        {log.targetType}: <span className="text-neutral-600 dark:text-neutral-400">{truncate(log.targetId ?? '-', 20)}</span>
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4">
                    {log.errorMessage ? (
                      <span className="truncate block max-w-[180px] text-xs text-red-600 dark:text-red-300" title={log.errorMessage}>{log.errorMessage}</span>
                    ) : (
                      <span className="text-neutral-400">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-5">
                    {log.method || log.path ? (
                      <div className="font-mono text-xs">
                        {log.method && <span className="text-neutral-600 dark:text-neutral-400">{log.method}</span>}
                        {log.method && log.path && <span className="mx-1 text-neutral-400">→</span>}
                        {log.path && <span className="truncate inline-block max-w-[160px] text-neutral-500" title={log.path}>{log.path}</span>}
                      </div>
                    ) : (
                      <span className="text-neutral-400">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {activeLog && <LogDetailDialog log={activeLog} onClose={() => setActiveId(null)} />}
    </>
  )
}
