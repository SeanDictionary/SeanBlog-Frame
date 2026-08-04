import { Suspense } from 'react'

import { AnalyticsTracker } from '@/components/analytics/analytics-tracker'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { getSiteSettingsMap } from '@/lib/services/setting-service'
import { readThemeCss } from '@/lib/theme'

function buildThemeOptionsCss(settings: Record<string, unknown>) {
  const variables: string[] = []

  if (typeof settings.themeAccentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(settings.themeAccentColor)) {
    variables.push(`--color-accent: ${settings.themeAccentColor}`)
  }

  if (typeof settings.themeContentMaxWidth === 'string' && /^\d+(?:\.\d+)?(?:rem|px)$/.test(settings.themeContentMaxWidth)) {
    variables.push(`--content-max-width: ${settings.themeContentMaxWidth}`)
  }

  if (typeof settings.themeRadius === 'string' && /^\d+(?:\.\d+)?(?:rem|px)$/.test(settings.themeRadius)) {
    variables.push(`--radius: ${settings.themeRadius}`, `--radius-lg: ${settings.themeRadius}`)
  }

  if (typeof settings.themeHeaderHeight === 'string' && /^\d+(?:\.\d+)?(?:rem|px)$/.test(settings.themeHeaderHeight)) {
    variables.push(`--header-height: ${settings.themeHeaderHeight}`)
  }

  return variables.length ? `:root{${variables.join(';')}}` : null
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await getSiteSettingsMap()
  const activeTheme = typeof settings.activeTheme === 'string' ? settings.activeTheme : 'default'
  const customThemeCss = activeTheme !== 'default' ? await readThemeCss(activeTheme) : null
  const themeOptionsCss = buildThemeOptionsCss(settings)

  return (
    <div className="flex min-h-screen flex-col">
      {customThemeCss && <style>{customThemeCss}</style>}
      {themeOptionsCss && <style>{themeOptionsCss}</style>}
      <SiteHeader settings={settings} />
      <main className="flex-1">{children}</main>
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
      <SiteFooter settings={settings} />
    </div>
  )
}
