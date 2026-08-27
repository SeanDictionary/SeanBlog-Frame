import Link from 'next/link'

type SiteFooterProps = {
  settings?: Record<string, unknown>
}

function settingEnabled(settings: Record<string, unknown> | undefined, key: string, fallback = true) {
  const value = settings?.[key]
  return typeof value === 'boolean' ? value : fallback
}

export function SiteFooter({ settings }: SiteFooterProps) {
  const footerHtml = typeof settings?.publicFooterText === 'string' && settings.publicFooterText.trim()
    ? settings.publicFooterText
    : `<p>© ${new Date().getFullYear()} SeanBlog. All rights reserved.</p>`
  const showRss = settingEnabled(settings, 'publicFooterShowRss')

  return (
    <footer className="sb-site-footer border-t border-border">
      <div className="sb-site-footer-inner mx-auto flex max-w-[var(--content-max-width)] items-center justify-between gap-4 px-[var(--content-padding)] py-6 text-sm text-text-tertiary">
        <div dangerouslySetInnerHTML={{ __html: footerHtml }} />
        {showRss && (
          <Link href="/rss.xml" className="transition-colors hover:text-text-secondary" aria-label="RSS Feed">
            <i className="fa-solid fa-rss" />
          </Link>
        )}
      </div>
    </footer>
  )
}
