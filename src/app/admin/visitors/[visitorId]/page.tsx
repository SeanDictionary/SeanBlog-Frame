import Link from 'next/link'
import type { Route } from 'next'

import { ExternalLink } from '@/components/common/external-link'
import { Card } from '@/components/ui/card'
import { formatDateTimeShort, formatDurationFull } from '@/lib/format'
import { getVisitorDetail } from '@/lib/services/analytics-service'
import { VisitRecordTable } from '@/components/admin/analytics-dashboard'

function isExternalUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

function toDetailParts(value: string | null, labels: Record<string, string>): Array<{ label: string; value: string }> | null {
  if (!value) return null
  try {
    const data = JSON.parse(value) as Record<string, unknown>
    const entries = Object.entries(data).filter(([key]) => key in labels).map(([key, val]) => ({ label: labels[key], value: `${val}` }))
    return entries.length ? entries : null
  } catch { return null }
}

const FINGERPRINT_LABELS: Record<string, string> = { language: '语言', timezone: '时区', screenWidth: '屏幕宽度', screenHeight: '屏幕高度', devicePixelRatio: '像素比' }
const HARDWARE_LABELS: Record<string, string> = { cores: 'CPU 核心数', memory: '内存', screenWidth: '屏幕宽度', screenHeight: '屏幕高度' }

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function ListItem({ title, detail, href }: { title: string; detail?: string; href?: Route }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2.5 text-sm last:border-b-0 dark:border-neutral-900">
      {href ? (
        <Link href={href} className="truncate font-medium transition-colors hover:text-blue-600 dark:hover:text-blue-300">{title}</Link>
      ) : (
        <span className="truncate font-medium">{title}</span>
      )}
      {detail && <span className="shrink-0 text-neutral-500">{detail}</span>}
    </div>
  )
}

export default async function VisitorDetailPage({
  params,
}: {
  params: Promise<{ visitorId: string }>
}) {
  const { visitorId } = await params
  const data = await getVisitorDetail(visitorId)

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl">
        <p className="py-20 text-center text-neutral-500">未找到该访客。</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <a href="/admin/visitors" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">
            <i className="fa-solid fa-arrow-left mr-2 text-xs" aria-hidden="true" />访客记录
          </a>
        </div>
        <p className="mb-2 text-sm text-neutral-500">数据分析 / 访客记录 / 详情</p>
        <h1 className="text-3xl font-semibold tracking-tight">访客详情</h1>
        <p className="mt-2 font-mono text-xs text-neutral-500">{data.visitorId}</p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatItem label="访问次数" value={String(data.visitCount)} />
        <StatItem label="事件数" value={String(data.eventCount)} />
        <StatItem label="总时长" value={formatDurationFull(data.totalDurationSeconds)} />
        <StatItem label="首次访问" value={formatDateTimeShort(data.firstSeenAt)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">文章访问统计</h2>
          {data.topArticles.length > 0 ? data.topArticles.map((a) => (
            <ListItem key={a.slug} title={a.title} detail={`${a.views} 次 / ${a.visitors} 人`} href={`/articles/${a.slug}` as Route} />
          )) : <p className="text-sm text-neutral-500">暂无文章访问。</p>}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">分类访问统计</h2>
          {data.topCategories.length > 0 ? data.topCategories.map((c) => (
            <ListItem key={c.slug} title={c.title} detail={`${c.views} 次`} href={`/categories/${c.slug}` as Route} />
          )) : <p className="text-sm text-neutral-500">暂无分类访问。</p>}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">标签访问统计</h2>
          {data.topTags.length > 0 ? data.topTags.map((t) => (
            <ListItem key={t.slug} title={t.title} detail={`${t.views} 次`} href={`/tags/${t.slug}` as Route} />
          )) : <p className="text-sm text-neutral-500">暂无标签访问。</p>}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">来源 URL 统计</h2>
          {data.topReferrers.length > 0 ? data.topReferrers.map((r) => (
            <ListItem key={r.referrer} title={r.referrer} detail={`${r.count} 次`} />
          )) : <p className="text-sm text-neutral-500">暂无来源 URL。</p>}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">浏览器指纹记录</h2>
          {data.fingerprints.length > 0 ? data.fingerprints.map((fp) => {
            const parts = toDetailParts(fp.browserFingerprint, FINGERPRINT_LABELS)
            return (
              <div key={fp.browserFingerprint} className="mb-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                <p className="mb-2 text-xs text-neutral-500">{fp.count} 次</p>
                {parts ? (
                  <ul className="space-y-0.5">
                    {parts.map((p) => <li key={p.label} className="flex justify-between gap-3 text-xs"><span className="text-neutral-500">{p.label}</span><span className="font-mono">{p.value}</span></li>)}
                  </ul>
                ) : <p className="font-mono text-xs text-neutral-500">{fp.browserFingerprint}</p>}
              </div>
            )
          }) : <p className="text-sm text-neutral-500">暂无指纹数据。</p>}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">硬件信息记录</h2>
          {data.hardwareInfos.length > 0 ? data.hardwareInfos.map((hw) => {
            const parts = toDetailParts(hw.hardware, HARDWARE_LABELS)
            return (
              <div key={hw.hardware} className="mb-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                <p className="mb-2 text-xs text-neutral-500">{hw.count} 次</p>
                {parts ? (
                  <ul className="space-y-0.5">
                    {parts.map((p) => <li key={p.label} className="flex justify-between gap-3 text-xs"><span className="text-neutral-500">{p.label}</span><span className="font-mono">{p.value}</span></li>)}
                  </ul>
                ) : <p className="font-mono text-xs text-neutral-500">{hw.hardware}</p>}
              </div>
            )
          }) : <p className="text-sm text-neutral-500">暂无硬件数据。</p>}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">地区统计</h2>
          {data.topCountries.length > 0 ? data.topCountries.map((c) => (
            <ListItem key={c.country} title={c.country} detail={`${c.count} 次`} />
          )) : <p className="text-sm text-neutral-500">暂无地区数据。</p>}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">浏览器/系统统计</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-neutral-500">浏览器</p>
              {data.topBrowsers.map((b) => <ListItem key={b.browser} title={b.browser} detail={`${b.count} 次`} />)}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-neutral-500">操作系统</p>
              {data.topSystems.map((s) => <ListItem key={s.os} title={s.os} detail={`${s.count} 次`} />)}
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-4 font-semibold">最近 10 条访问记录</h2>
        <VisitRecordTable visits={data.recentVisits} />
      </Card>
    </div>
  )
}
