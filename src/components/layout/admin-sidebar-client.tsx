'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Route } from 'next'
import { useEffect, useState } from 'react'

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

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const syncCollapsedState = () => setIsCollapsed(mediaQuery.matches)

    syncCollapsedState()
    mediaQuery.addEventListener('change', syncCollapsedState)

    return () => mediaQuery.removeEventListener('change', syncCollapsedState)
  }, [])

  return (
    <aside className={`sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-white px-4 py-5 dark:border-neutral-800 dark:bg-neutral-950 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className="flex shrink-0 items-start justify-between gap-2">
        <Link
          href="/admin"
          className={`min-w-0 text-neutral-950 transition-opacity dark:text-neutral-50 ${isCollapsed ? 'sr-only' : 'px-3'}`}
        >
          <span className="whitespace-nowrap text-lg font-semibold leading-tight tracking-tight">SeanBlog <span className="font-normal text-neutral-400">Admin</span></span>
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

      <nav className="scrollbar-themed -mx-1 mt-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1" aria-label="后台导航">
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
              className={`grid h-9 min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center overflow-hidden rounded-md text-sm transition-colors ${isCollapsed ? 'justify-items-center' : 'pr-3'} ${
                isActive
                  ? 'bg-neutral-100 text-neutral-950 dark:bg-neutral-900 dark:text-neutral-50'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50'
              }`}
            >
              <i className={`${item.icon} w-4 justify-self-center text-center text-sm`} aria-hidden="true" />
              {!isCollapsed && <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left">{item.label}</span>}
            </Link>
          )
        })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-neutral-200 pt-5 text-sm dark:border-neutral-800">
        {!isCollapsed && <p className="mb-2 truncate px-3 font-medium text-neutral-800 dark:text-neutral-200">{userName}</p>}
        <div className="grid gap-2">
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label={isCollapsed ? '退出登录' : undefined}
              title={isCollapsed ? '退出登录' : undefined}
              className={`grid h-6 w-full grid-cols-[2.5rem_minmax(0,1fr)] items-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-red-600 dark:hover:bg-neutral-900 dark:hover:text-red-400 ${isCollapsed ? 'justify-items-center' : 'pr-3'}`}
            >
              <i className="fa-solid fa-arrow-right-from-bracket justify-self-center text-sm" aria-hidden="true" />
              {!isCollapsed && <span className="whitespace-nowrap text-left">退出</span>}
            </button>
          </form>
          <Link
            href="/"
            aria-label={isCollapsed ? '查看网站' : undefined}
            title={isCollapsed ? '查看网站' : undefined}
            className={`grid h-6 w-full grid-cols-[2.5rem_minmax(0,1fr)] items-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-neutral-100 ${isCollapsed ? 'justify-items-center' : 'pr-3'}`}
          >
            <i className="fa-solid fa-arrow-up-right-from-square justify-self-center text-sm" aria-hidden="true" />
            {!isCollapsed && <span className="whitespace-nowrap text-left">查看网站</span>}
          </Link>
        </div>
      </div>
    </aside>
  )
}
