import Link from 'next/link'

import { SearchDialog } from '@/components/search/search-dialog'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-sm">
      <div className="mx-auto flex h-(--header-height) max-w-(--content-max-width) items-center justify-between px-(--content-padding)">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          SeanBlog
        </Link>
        <nav className="flex items-center gap-5 text-sm text-text-secondary" aria-label="主导航">
          <Link href="/" className="transition-colors hover:text-text">
            首页
          </Link>
          <Link href="/categories" className="transition-colors hover:text-text">
            分类
          </Link>
          <Link href="/tags" className="transition-colors hover:text-text">
            标签
          </Link>
          <SearchDialog />
        </nav>
      </div>
    </header>
  )
}
