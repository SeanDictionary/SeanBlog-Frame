import { Suspense } from 'react'

import { AnalyticsTracker } from '@/components/analytics/analytics-tracker'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { getMergedSettings } from '@/lib/services/theme-settings-service'
import { buildThemeCssBundle } from '@/lib/theme/css-bundle'
import { readThemeManifest, readThemePart } from '@/lib/theme'

function normalizeActiveTheme(value: unknown) {
  return typeof value === 'string' && value !== 'default' ? value : 'seanblog-default'
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 安全加载设置，数据库不可用时降级
  let settings: Record<string, unknown> = {}
  let activeTheme = 'seanblog-default'
  let themeCssBundle: { css: string; calloutCss: string } | null = null
  try {
    settings = await getMergedSettings()
    activeTheme = normalizeActiveTheme(settings.activeTheme)
    themeCssBundle = await buildThemeCssBundle()
  } catch (e) {
    console.error('[public-layout] settings/css load failed:', e)
  }
  const [headerPart, footerPart] = await Promise.all([
    readThemePart(activeTheme, 'header'),
    readThemePart(activeTheme, 'footer'),
  ])
  const showHeader = headerPart?.blocks?.includes('SiteHeader') ?? true
  const showFooter = footerPart?.blocks?.includes('SiteFooter') ?? true

  // showTopBar 主题设置控制是否渲染顶部栏
  const showTopBar = settings.showTopBar !== false && showHeader

  return (
    <div className="flex min-h-screen flex-col">
      {themeCssBundle?.css && <style>{themeCssBundle.css}</style>}
      {themeCssBundle?.calloutCss && <style>{themeCssBundle.calloutCss}</style>}
      {showTopBar && <SiteHeader settings={settings} />}
      <main className="flex-1">{children}</main>
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
      {showFooter && <SiteFooter settings={settings} />}
    </div>
  )
}
