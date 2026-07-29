import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { getSiteSettingsMap } from '@/lib/services/setting-service'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await getSiteSettingsMap()
  const activeTheme = typeof settings.activeTheme === 'string' ? settings.activeTheme : undefined

  return (
    <div className="flex min-h-screen flex-col" data-theme={activeTheme === 'dark' || activeTheme === 'light' ? activeTheme : undefined}>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
