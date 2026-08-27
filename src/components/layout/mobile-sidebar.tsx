'use client'

import { useState, type ReactNode } from 'react'

type MobileSidebarProps = {
  children: ReactNode
  /** 'left' or 'right' — which side the drawer slides in from */
  side?: 'left' | 'right'
}

/**
 * Mobile sidebar drawer.
 * On desktop (lg+): renders as a regular <aside> with sticky positioning.
 * On mobile (<lg): renders a hamburger button + slide-in drawer.
 */
export function MobileSidebar({ children, side = 'right' }: MobileSidebarProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop: regular aside */}
      <aside className="hidden w-[var(--layout-sidebar-width)] shrink-0 lg:block">
        <div className="sticky top-20">{children}</div>
      </aside>

      {/* Mobile: hamburger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="打开侧边栏"
        className={`fixed top-2 z-50 flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-text-secondary transition-colors hover:text-text lg:hidden ${
          side === 'left' ? 'left-2' : 'right-2'
        }`}
      >
        <i className="fa-solid fa-bars text-sm" />
      </button>

      {/* Mobile: drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-[var(--color-overlay)] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile: drawer panel */}
      <aside
        className={`fixed top-0 z-50 h-full w-[280px] overflow-auto bg-[var(--color-bg)] p-4 transition-transform duration-300 lg:hidden ${
          side === 'left' ? 'left-0' : 'right-0'
        } ${open ? 'translate-x-0' : side === 'left' ? '-translate-x-full' : 'translate-x-full'}`}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="关闭侧边栏"
          className="mb-4 flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-text-secondary transition-colors hover:text-text"
        >
          <i className="fa-solid fa-xmark text-lg" />
        </button>
        {children}
      </aside>
    </>
  )
}
