import { Suspense } from 'react'

import { AnalyticsTracker } from '@/components/analytics/analytics-tracker'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { getSiteSettingsMapSafe } from '@/lib/services/setting-service'
import { readThemeCss, readThemeManifest, readThemePart } from '@/lib/theme'

function normalizeActiveTheme(value: unknown) {
  return typeof value === 'string' && value !== 'default' ? value : 'seanblog-default'
}

async function buildThemeOptionsCss(themeSlug: string, settings: Record<string, unknown>) {
  const manifest = await readThemeManifest(themeSlug).catch(() => null)
  if (!manifest?.settingsSchema?.length) return null

  const variables = manifest.settingsSchema
    .map((item) => {
      if (!item.cssVariable) return null
      const value = settings[`themeSetting:${manifest.slug}:${item.key}`] ?? item.default
      if (typeof value !== 'string' && typeof value !== 'number') return null
      return `${item.cssVariable}: ${value}`
    })
    .filter((item): item is string => item !== null)

  return variables.length ? `:root{${variables.join(';')}}` : null
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await getSiteSettingsMapSafe()
  const activeTheme = normalizeActiveTheme(settings.activeTheme)
  const customThemeCss = await readThemeCss(activeTheme) ?? await readThemeCss('seanblog-default')
  const themeOptionsCss = await buildThemeOptionsCss(activeTheme, settings) ?? await buildThemeOptionsCss('seanblog-default', settings)
  const [headerPart, footerPart] = await Promise.all([
    readThemePart(activeTheme, 'header'),
    readThemePart(activeTheme, 'footer'),
  ])
  const showHeader = headerPart?.blocks?.includes('SiteHeader') ?? true
  const showFooter = footerPart?.blocks?.includes('SiteFooter') ?? true

  return (
    <div className="flex min-h-screen flex-col">
      {customThemeCss && <style>{customThemeCss}</style>}
      {themeOptionsCss && <style>{themeOptionsCss}</style>}
      {showHeader && <SiteHeader settings={settings} />}
      <main className="flex-1">{children}</main>
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
      {showFooter && <SiteFooter settings={settings} />}
    </div>
  )
}
