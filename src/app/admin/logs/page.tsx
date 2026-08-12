import type { OperationLogResult } from '@prisma/client'

import { listOperationLogs } from '@/lib/services/operation-log-service'
import { operationLogQuerySchema } from '@/lib/validations/cms'

type AdminLogsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>
}

const resultLabels = {
  SUCCESS: '成功',
  FAILURE: '失败',
} satisfies Record<OperationLogResult, string>

const resultStyles = {
  SUCCESS: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300',
  FAILURE: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300',
} satisfies Record<OperationLogResult, string>

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

function buildExportHref(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page' && key !== 'pageSize') searchParams.set(key, value)
  }

  const query = searchParams.toString()
  return `/api/admin/logs/export${query ? `?${query}` : ''}`
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(value)
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
        <a href={buildExportHref(rawSearchParams)} className="rounded-md bg-neutral-950 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-950">导出 CSV</a>
      </header>

      <form action="/admin/logs" className="mb-6 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto]">
        <label className="grid gap-1.5">关键词<input name="q" defaultValue={query.q ?? ''} placeholder="搜索操作、对象、错误信息" className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <label className="grid gap-1.5">模块<input name="module" defaultValue={query.module ?? ''} placeholder="article / comment" className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <label className="grid gap-1.5">结果<select name="result" defaultValue={query.result ?? ''} className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900"><option value="">全部</option><option value="SUCCESS">成功</option><option value="FAILURE">失败</option></select></label>
        <div className="flex items-end"><button className="rounded-md bg-neutral-950 px-4 py-2 font-medium text-white dark:bg-neutral-100 dark:text-neutral-950">应用</button></div>
      </form>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">日志记录</h2><p className="mt-1 text-sm text-neutral-500">共 {result.meta.total} 条记录，第 {result.meta.page} / {Math.max(1, result.meta.pageCount)} 页。</p></div>
          <div className="flex gap-2 text-sm">{previousHref ? <a href={previousHref} className="rounded-md border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">上一页</a> : <span className="rounded-md border border-neutral-200 px-3 py-1.5 text-neutral-400 dark:border-neutral-800">上一页</span>}{nextHref ? <a href={nextHref} className="rounded-md border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">下一页</a> : <span className="rounded-md border border-neutral-200 px-3 py-1.5 text-neutral-400 dark:border-neutral-800">下一页</span>}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-250 text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800">
              <tr><th className="py-2 pr-4 font-medium">时间</th><th className="py-2 pr-4 font-medium">结果</th><th className="py-2 pr-4 font-medium">模块 / 操作</th><th className="py-2 pr-4 font-medium">操作人</th><th className="py-2 pr-4 font-medium">内容</th><th className="py-2 pr-4 font-medium">错误</th><th className="py-2 pr-4 font-medium">请求</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {result.items.map((log) => {
                const metadata = formatMetadata(log.metadata)

                return (
                  <tr key={log.id}>
                    <td className="py-3 pr-4 align-top text-neutral-500">{formatDate(log.createdAt)}</td>
                    <td className="py-3 pr-4 align-top"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${resultStyles[log.result]}`}>{resultLabels[log.result]}</span></td>
                    <td className="py-3 pr-4 align-top"><span className="font-mono text-xs text-neutral-500">{log.module}</span><span className="mt-1 block">{log.action}</span></td>
                    <td className="py-3 pr-4 align-top"><span>{log.actorName ?? (log.actorType === 'visitor' ? '访客' : '系统')}</span><span className="mt-1 block text-xs text-neutral-500">{log.actorType}</span></td>
                    <td className="py-3 pr-4 align-top"><p>{log.summary}</p>{log.targetType && <p className="mt-1 font-mono text-xs text-neutral-500">{log.targetType}: {log.targetId ?? '-'}</p>}{metadata && <p className="mt-1 max-w-100 truncate font-mono text-xs text-neutral-500" title={metadata}>{metadata}</p>}</td>
                    <td className="py-3 pr-4 align-top text-red-600 dark:text-red-300">{log.errorMessage ? <><span className="font-mono text-xs">{log.errorCode}</span><span className="mt-1 block">{log.errorMessage}</span></> : <span className="text-neutral-400">-</span>}</td>
                    <td className="py-3 pr-4 align-top"><span className="font-mono text-xs text-neutral-500">{log.method ?? '-'}</span>{log.path && <span className="mt-1 block max-w-60 truncate font-mono text-xs text-neutral-500" title={log.path}>{log.path}</span>}</td>
                  </tr>
                )
              })}
              {result.items.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-neutral-500">暂无操作日志。</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
