'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Route } from 'next'
import { useState } from 'react'

type AdminNavigationItem = {
  href: Route
  label: string
  icon: string
}

type AdminSidebarClientProps = {
  navigation: AdminNavigationItem[]
  userName: string
  signOutAction: () => Promise<void>
}

export function AdminSidebarClient({ navigation, userName, signOutAction }: AdminSidebarClientProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <aside className={`sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-white px-4 py-5 transition-[width] duration-200 dark:border-neutral-800 dark:bg-neutral-950 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className="flex shrink-0 items-start justify-between gap-2">
        <Link
          href="/admin"
          className={`min-w-0 text-neutral-950 transition-opacity dark:text-neutral-50 ${isCollapsed ? 'sr-only' : 'px-3'}`}
        >
          <span className="block text-lg font-semibold leading-tight tracking-tight">SeanBlog</span>
          <span className="mt-0.5 block text-sm font-normal tracking-wide text-neutral-400">Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setIsCollapsed((value) => !value)}
          className="grid size-10 shrink-0 place-items-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
          aria-label={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          <i className={`fa-solid ${isCollapsed ? 'fa-angles-right' : 'fa-angles-left'} text-sm`} aria-hidden="true" />
        </button>
      </div>

      <nav className="scrollbar-themed -mx-1 mt-10 min-h-0 flex-1 overflow-y-auto px-1" aria-label="后台导航">
        <div className="space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`))

          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              aria-label={isCollapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center rounded-md py-2 text-sm transition-colors ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} ${
                isActive
                  ? 'bg-neutral-100 text-neutral-950 dark:bg-neutral-900 dark:text-neutral-50'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50'
              }`}
            >
              <i className={`${item.icon} w-4 text-center ${isCollapsed ? 'text-base' : ''}`} aria-hidden="true" />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
        </div>
      </nav>

      <div className={`shrink-0 border-t border-neutral-200 pt-5 text-sm dark:border-neutral-800 ${isCollapsed ? 'px-0' : 'px-3'}`}>
        {isCollapsed ? (
          <div className="grid gap-2">
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="退出登录"
                title="退出登录"
                className="grid size-10 place-items-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-red-600 dark:hover:bg-neutral-900 dark:hover:text-red-400"
              >
                <i className="fa-solid fa-arrow-right-from-bracket text-sm" aria-hidden="true" />
              </button>
            </form>
            <Link
              href="/"
              aria-label="查看网站"
              title="查看网站"
              className="grid size-10 place-items-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-sm" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="truncate font-medium text-neutral-800 dark:text-neutral-200">{userName}</p>
              <form action={signOutAction} className="shrink-0">
                <button type="submit" className="inline-flex items-center gap-1.5 text-neutral-500 transition-colors hover:text-red-600 dark:hover:text-red-400">
                  <i className="fa-solid fa-arrow-right-from-bracket text-xs" aria-hidden="true" />
                  退出
                </button>
              </form>
            </div>
            <Link href="/" className="mt-3 inline-flex items-center gap-2 text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">
              <i className="fa-solid fa-arrow-up-right-from-square text-xs" aria-hidden="true" />
              查看网站
            </Link>
          </>
        )}
      </div>
    </aside>
  )
}
