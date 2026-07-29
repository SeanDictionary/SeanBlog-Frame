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
  const activeTheme = typeof settings.activeTheme === 'string' ? settings.activeTheme : undefined
  const customThemeCss = activeTheme && activeTheme !== 'default' ? await readThemeCss(activeTheme) : null

  return (
    <div className="flex min-h-screen flex-col" data-theme={activeTheme === 'dark' || activeTheme === 'light' ? activeTheme : undefined}>
      {customThemeCss && <style>{customThemeCss}</style>}
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
