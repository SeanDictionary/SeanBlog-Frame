import { Suspense } from 'react'

import { AnalyticsTracker } from '@/components/analytics/analytics-tracker'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { getSiteSettingsMap } from '@/lib/services/setting-service'
import { readThemeCss } from '@/lib/theme'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await getSiteSettingsMap()
  const activeTheme = typeof settings.activeTheme === 'string' ? settings.activeTheme : 'default'
  const customThemeCss = activeTheme !== 'default' ? await readThemeCss(activeTheme) : null

  return (
    <div className="flex min-h-screen flex-col">
      {customThemeCss && <style>{customThemeCss}</style>}
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
      <SiteFooter />
    </div>
  )
}
