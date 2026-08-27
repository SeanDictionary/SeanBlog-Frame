import Link from 'next/link'

import { SearchDialog } from '@/components/search/search-dialog'
import { ThemeToggle } from '@/components/layout/theme-toggle'

type SiteHeaderProps = {
  settings?: Record<string, unknown>
}

export function SiteHeader({ settings }: SiteHeaderProps) {
  const title = typeof settings?.publicHeaderTitle === 'string' && settings.publicHeaderTitle.trim()
    ? settings.publicHeaderTitle
    : typeof settings?.siteName === 'string' && settings.siteName.trim()
      ? settings.siteName
      : 'SeanBlog'

  const showThemeToggle = settings?.showThemeToggle !== false && settings?.showThemeToggle !== 'false'
  const hasSidebar = typeof settings?.sidebarPosition === 'string' && settings.sidebarPosition !== 'none'

  return (
    <header className="sb-site-header sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-sm">
      <div className="sb-site-header-inner mx-auto flex h-(--header-height) max-w-(--content-max-width) items-center justify-between px-(--content-padding)">
        <div className="flex items-center gap-3">
          {/* 移动端侧边栏留出空间 */}
          {hasSidebar && <span className="inline-block w-8 lg:hidden" />}
          <Link href="/" className="sb-site-brand text-lg font-semibold tracking-tight">
            {title}
          </Link>
        </div>
        <nav className="sb-site-nav flex items-center gap-5 text-base text-text-secondary" aria-label="主导航">
          <Link href="/" className="transition-colors hover:text-text">首页</Link>
          <Link href="/categories" className="transition-colors hover:text-text">分类</Link>
          <Link href="/tags" className="transition-colors hover:text-text">标签</Link>
          <SearchDialog />
          {showThemeToggle && <ThemeToggle />}
        </nav>
      </div>
    </header>
  )
}
