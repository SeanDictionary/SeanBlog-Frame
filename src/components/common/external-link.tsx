'use client'

import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'

type ExternalLinkProps = {
  href: string
  children: React.ReactNode
  className?: string
  ariaLabel?: string
}

// Intercepts clicks on a visitor-provided external link and shows a
// confirmation dialog containing the full URL, so the visitor can verify the
// destination before being sent to a potentially phishing site. The actual
// navigation only happens after an explicit "继续访问" click, and opens in a
// new tab with noopener/noreferrer.
export function ExternalLink({ href, children, className, ariaLabel }: ExternalLinkProps) {
  const [open, setOpen] = useState(false)
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    confirmRef.current?.focus()

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // Stop the link from navigating directly (and stop parent row handlers
    // such as the admin moderation row) so we can confirm first.
    event.preventDefault()
    event.stopPropagation()
    setOpen(true)
  }

  function proceed() {
    setOpen(false)
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <a href={href} onClick={handleClick} className={className} aria-label={ariaLabel} rel="noopener noreferrer nofollow">
        {children}
      </a>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-(--radius-lg) border border-border bg-bg-primary p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">即将打开外部链接</h2>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              该链接由评论者提供，不代表本站立场。离开本站后请仔细核对网址，防范钓鱼与仿冒网站。
            </p>
            <div className="mt-4 break-all rounded-(--radius) bg-bg-tertiary p-3 font-mono text-xs text-text">
              {href}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-sm border border-border px-4 py-2 text-sm transition-colors hover:bg-bg-secondary"
              >
                取消
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={proceed}
                className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                继续访问
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
