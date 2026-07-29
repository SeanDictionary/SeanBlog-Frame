import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[var(--content-max-width)] items-center justify-between px-[var(--content-padding)] py-6 text-sm text-text-tertiary">
        <p>&copy; {new Date().getFullYear()} SeanBlog. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="/rss.xml" className="transition-colors hover:text-text-secondary" aria-label="RSS Feed">
            <i className="fa-solid fa-rss" />
          </Link>
        </div>
      </div>
    </footer>
  )
}
