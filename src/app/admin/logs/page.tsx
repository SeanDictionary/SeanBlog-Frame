import type { OperationLogResult } from '@prisma/client'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { ExportCsvButton, buildExportHref } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/format'
import { listOperationLogs } from '@/lib/services/operation-log-service'
import { operationLogQuerySchema } from '@/lib/validations/cms'

type AdminLogsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>
}

const resultLabels = {
  SUCCESS: '成功',
  FAILURE: '失败',
} satisfies Record<OperationLogResult, string>

const resultBadgeTones: Record<OperationLogResult, BadgeTone> = {
  SUCCESS: 'green',
  FAILURE: 'red',
}

function buildHref(params: Record<string, string | undefined>, overrides: Record<string, string | null>) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value && !(key in overrides)) searchParams.set(key, value)
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value) searchParams.set(key, value)
  }

  const query = searchParams.toString()
  return `/admin/logs${query ? `?${query}` : ''}`
}

function formatMetadata(value: unknown) {
  if (!value) return null

  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

export default async function AdminLogsPage({ searchParams }: AdminLogsPageProps) {
  const rawSearchParams = await searchParams
  const query = operationLogQuerySchema.parse(rawSearchParams)
  const result = await listOperationLogs(query)
  const previousHref = result.meta.page > 1 ? buildHref(rawSearchParams, { page: String(result.meta.page - 1) }) : null
  const nextHref = result.meta.page < result.meta.pageCount ? buildHref(rawSearchParams, { page: String(result.meta.page + 1) }) : null

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-neutral-500">后台管理 / 操作记录</p>
          <h1 className="text-3xl font-semibold tracking-tight">操作日志</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">记录前后台关键写操作的时间、操作人、内容、结果和错误信息，支持筛选与 CSV 导出。</p>
        </div>
        <ExportCsvButton href={buildExportHref('/api/admin/logs/export', rawSearchParams)} />
      </header>

      <form action="/admin/logs" className="mb-6 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto]">
        <label className="grid gap-1.5">关键词<input name="q" defaultValue={query.q ?? ''} placeholder="搜索操作、对象、错误信息" className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <label className="grid gap-1.5">模块<input name="module" defaultValue={query.module ?? ''} placeholder="article / comment" className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <label className="grid gap-1.5">结果<select name="result" defaultValue={query.result ?? ''} className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900"><option value="">全部</option><option value="SUCCESS">成功</option><option value="FAILURE">失败</option></select></label>
        <div className="flex items-end"><button className="rounded-md bg-neutral-950 px-4 py-2 font-medium text-white dark:bg-neutral-100 dark:text-neutral-950">应用</button></div>
      </form>

      <Card>
        <CardHeader
          title="日志记录"
          description={`共 ${result.meta.total} 条记录，第 ${result.meta.page} / ${Math.max(1, result.meta.pageCount)} 页。`}
          action={
            <div className="flex gap-2 text-sm">{previousHref ? <a href={previousHref} className="rounded-md border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">上一页</a> : <span className="rounded-md border border-neutral-200 px-3 py-1.5 text-neutral-400 dark:border-neutral-800">上一页</span>}{nextHref ? <a href={nextHref} className="rounded-md border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">下一页</a> : <span className="rounded-md border border-neutral-200 px-3 py-1.5 text-neutral-400 dark:border-neutral-800">下一页</span>}</div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="whitespace-nowrap py-2 pr-4 font-medium w-36">时间</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium w-16">结果</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium w-28">模块 / 操作</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium w-24">操作人</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">内容</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium w-48">错误</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium w-48">请求</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {result.items.map((log) => {
                const metadata = formatMetadata(log.metadata)
                const actorDisplay = log.actorName ?? (log.actorType === 'visitor' ? '访客' : '系统')
                const moduleAction = `${log.module}.${log.action}`

                return (
                  <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                    <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-neutral-500">{formatDateTime(log.createdAt)}</td>
                    <td className="py-2 pr-4"><Badge tone={resultBadgeTones[log.result]}>{resultLabels[log.result]}</Badge></td>
                    <td className="py-2 pr-4 font-mono text-xs text-neutral-600 dark:text-neutral-400">{moduleAction}</td>
                    <td className="py-2 pr-4 text-xs">
                      <span>{actorDisplay}</span>
                      {log.actorType && <span className="ml-1 text-neutral-400">({log.actorType})</span>}
                    </td>
                    <td className="py-2 pr-4">
                      <p className="text-neutral-800 dark:text-neutral-200">{log.summary}</p>
                      {log.targetType && (
                        <p className="mt-0.5 font-mono text-xs text-neutral-500">
                          {log.targetType}: <span className="text-neutral-600 dark:text-neutral-400">{log.targetId ?? '-'}</span>
                        </p>
                      )}
                      {metadata && (
                        <details className="mt-1">
                          <summary className="cursor-pointer font-mono text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
                            元数据
                          </summary>
                          <pre className="mt-1 max-h-32 overflow-auto rounded bg-neutral-100 p-2 font-mono text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {log.errorMessage ? (
                        <div>
                          {log.errorCode && <p className="font-mono text-xs text-red-600 dark:text-red-400">{log.errorCode}</p>}
                          <p className="mt-0.5 text-xs text-red-600 dark:text-red-300">{log.errorMessage}</p>
                        </div>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {log.method || log.path ? (
                        <div className="font-mono text-xs">
                          {log.method && <span className="text-neutral-600 dark:text-neutral-400">{log.method}</span>}
                          {log.method && log.path && <span className="mx-1 text-neutral-400">→</span>}
                          {log.path && <span className="text-neutral-500 truncate block max-w-40" title={log.path}>{log.path}</span>}
                        </div>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {result.items.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-neutral-500">暂无操作日志。</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
