import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-sm">
      <div className="mx-auto flex h-[var(--header-height)] max-w-[var(--content-max-width)] items-center justify-between px-[var(--content-padding)]">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          SeanBlog
        </Link>
        <nav className="flex items-center gap-6 text-sm text-text-secondary">
          <Link href="/" className="transition-colors hover:text-text">
            首页
          </Link>
          <Link href="/categories" className="transition-colors hover:text-text">
            分类
          </Link>
          <Link href="/tags" className="transition-colors hover:text-text">
            标签
          </Link>
          <Link href="/search" className="transition-colors hover:text-text">
            <i className="fa-solid fa-magnifying-glass" />
          </Link>
        </nav>
      </div>
    </header>
  )
}
