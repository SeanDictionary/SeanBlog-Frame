import Link from 'next/link'

import { SearchDialog } from '@/components/search/search-dialog'

type SiteHeaderProps = {
  settings?: Record<string, unknown>
}

function settingEnabled(settings: Record<string, unknown> | undefined, key: string, fallback = true) {
  const value = settings?.[key]
  return typeof value === 'boolean' ? value : fallback
}

export function SiteHeader({ settings }: SiteHeaderProps) {
  const title = typeof settings?.publicHeaderTitle === 'string' && settings.publicHeaderTitle.trim()
    ? settings.publicHeaderTitle
    : typeof settings?.siteName === 'string' && settings.siteName.trim()
      ? settings.siteName
      : 'SeanBlog'
  const showHome = settingEnabled(settings, 'publicHeaderShowHome')
  const showCategories = settingEnabled(settings, 'publicHeaderShowCategories')
  const showTags = settingEnabled(settings, 'publicHeaderShowTags')
  const showSearch = settingEnabled(settings, 'publicHeaderShowSearch')

  return (
    <header className="sb-site-header sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-sm">
      <div className="sb-site-header-inner mx-auto flex h-(--header-height) max-w-(--content-max-width) items-center justify-between px-(--content-padding)">
        <Link href="/" className="sb-site-brand text-lg font-semibold tracking-tight">
          {title}
        </Link>
        <nav className="sb-site-nav flex items-center gap-5 text-sm text-text-secondary" aria-label="主导航">
          {showHome && <Link href="/" className="transition-colors hover:text-text">首页</Link>}
          {showCategories && <Link href="/categories" className="transition-colors hover:text-text">分类</Link>}
          {showTags && <Link href="/tags" className="transition-colors hover:text-text">标签</Link>}
          {showSearch && <SearchDialog />}
        </nav>
      </div>
    </header>
  )
}
