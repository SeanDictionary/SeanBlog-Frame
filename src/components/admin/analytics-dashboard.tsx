import type { AnalyticsVisitRecord } from '@/lib/services/analytics-service'
import { ExternalLink } from '@/components/common/external-link'

function formatDuration(seconds: number | null) {
  if (seconds === null) return '未采集'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function isExternalUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

function contentHref(visit: AnalyticsVisitRecord) {
  if (visit.contentType === 'article' && visit.contentSlug) return `/articles/${visit.contentSlug}`
  if (visit.contentType === 'category' && visit.contentSlug) return `/categories/${visit.contentSlug}`
  if (visit.contentType === 'tag' && visit.contentSlug) return `/tags/${visit.contentSlug}`
  return visit.path
}

export function VisitRecordTable({ visits }: { visits: AnalyticsVisitRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-5xl text-left text-sm">
        <thead className="border-b border-neutral-100 text-xs text-neutral-500 dark:border-neutral-900">
          <tr><th className="py-2 pr-4">访问时间</th><th className="py-2 pr-4">访问时长</th><th className="py-2 pr-4">访问内容</th><th className="py-2 pr-4">地区 / IP</th><th className="py-2 pr-4">系统</th><th className="py-2 pr-4">浏览器</th><th className="py-2 pr-4">来源 URL</th></tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
          {visits.map((visit) => (
            <tr key={visit.id}>
              <td className="py-3 pr-4 font-mono text-xs">{visit.createdAt.toLocaleString('zh-CN')}</td>
              <td className="py-3 pr-4">{formatDuration(visit.durationSeconds)}</td>
              <td className="py-3 pr-4"><a href={contentHref(visit)} target="_blank" rel="noopener noreferrer" className="block max-w-52 truncate font-medium text-neutral-800 transition-colors hover:text-blue-600 dark:text-neutral-100 dark:hover:text-blue-300">{visit.contentLabel}</a><span className="mt-0.5 block max-w-52 truncate font-mono text-xs text-neutral-500">{visit.contentSlug ?? visit.path}</span></td>
              <td className="py-3 pr-4"><span className="block">{visit.country ?? '未知'}</span><span className="mt-0.5 block font-mono text-xs text-neutral-500">{visit.ipAddress ?? '未采集'}</span></td>
              <td className="py-3 pr-4">{visit.operatingSystem}</td>
              <td className="py-3 pr-4">{visit.browser}</td>
              <td className="py-3 pr-4">{isExternalUrl(visit.referrer) ? <ExternalLink href={visit.referrer} className="block max-w-56 truncate text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">{visit.referrer}</ExternalLink> : visit.referrer === null ? <span className="block max-w-56 truncate text-neutral-500">未采集</span> : <span className="block max-w-56 truncate text-neutral-500">直接访问</span>}</td>
            </tr>
          ))}
          {visits.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-neutral-500">暂无访问记录。</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
