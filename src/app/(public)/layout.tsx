import { Suspense } from 'react'

import { AnalyticsTracker } from '@/components/analytics/analytics-tracker'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { getSiteSettingsMapSafe } from '@/lib/services/setting-service'
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
  const settings = await getSiteSettingsMapSafe()
  const activeTheme = normalizeActiveTheme(settings.activeTheme)
  const themeCssBundle = await buildThemeCssBundle()
  const [headerPart, footerPart] = await Promise.all([
    readThemePart(activeTheme, 'header'),
    readThemePart(activeTheme, 'footer'),
  ])
  const showHeader = headerPart?.blocks?.includes('SiteHeader') ?? true
  const showFooter = footerPart?.blocks?.includes('SiteFooter') ?? true

  return (
    <div className="flex min-h-screen flex-col">
      {themeCssBundle?.css && <style>{themeCssBundle.css}</style>}
      {showHeader && <SiteHeader settings={settings} />}
      <main className="flex-1">{children}</main>
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
      {showFooter && <SiteFooter settings={settings} />}
    </div>
  )
}
