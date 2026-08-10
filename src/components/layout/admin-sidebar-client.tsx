'use client'

import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type AdminNavigationItem = {
  href: Route
  label: string
  icon: string
  children?: Array<{
    href: Route
    label: string
    icon: string
  }>
}

type AdminSidebarClientProps = {
  navigation: AdminNavigationItem[]
  userName: string
  siteName?: string
  signOutAction: () => Promise<void>
}

function isNavigationItemActive(pathname: string, item: AdminNavigationItem) {
  if (pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`))) return true
  return item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)) ?? false
}

export function AdminSidebarClient({ navigation, userName, siteName = 'SeanBlog', signOutAction }: AdminSidebarClientProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const activeParentHref = useMemo(() => navigation.find((item) => isNavigationItemActive(pathname, item) && item.children)?.href ?? null, [navigation, pathname])
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => activeParentHref ? new Set([activeParentHref]) : new Set())

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const syncCollapsedState = () => setIsCollapsed(mediaQuery.matches)

    syncCollapsedState()
    mediaQuery.addEventListener('change', syncCollapsedState)

    return () => mediaQuery.removeEventListener('change', syncCollapsedState)
  }, [])

  useEffect(() => {
    if (!activeParentHref) return
    setOpenGroups((previous) => {
      if (previous.has(activeParentHref)) return previous
      const next = new Set(previous)
      next.add(activeParentHref)
      return next
    })
  }, [activeParentHref])

  function toggleGroup(href: Route) {
    setOpenGroups((previous) => {
      const next = new Set(previous)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  return (
    <aside className={`sb-admin-sidebar sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-white px-4 py-5 dark:border-neutral-800 dark:bg-neutral-950 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className="flex shrink-0 items-start justify-between gap-2">
        <Link
          href="/admin"
          className={`min-w-0 text-neutral-950 transition-opacity dark:text-neutral-50 ${isCollapsed ? 'sr-only' : 'px-3'}`}
        >
          <span className="whitespace-nowrap text-lg font-semibold leading-tight tracking-tight">{siteName} <span className="font-normal text-neutral-400">Admin</span></span>
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
            const isActive = isNavigationItemActive(pathname, item)
            const hasChildren = Boolean(item.children?.length)
            const isOpen = openGroups.has(item.href)

            if (hasChildren) {
              return (
                <div key={item.href} className={isCollapsed && isOpen ? 'rounded-xl bg-neutral-100 dark:bg-neutral-900' : undefined}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.href)}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={isCollapsed ? item.label : undefined}
                    aria-expanded={isOpen}
                    className={`grid h-9 w-full min-w-0 items-center overflow-hidden rounded-md text-sm transition-colors ${isCollapsed ? 'grid-cols-[2.5rem] justify-items-center' : 'grid-cols-[2.5rem_minmax(0,1fr)_auto] pr-3'} ${
                      isActive
                        ? 'bg-neutral-100 text-neutral-950 dark:bg-neutral-900 dark:text-neutral-50'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50'
                    } ${isCollapsed && isOpen ? 'bg-white/70 dark:bg-neutral-950/60' : ''}`}
                  >
                    <i className={`${item.icon} w-4 justify-self-center text-center text-sm`} aria-hidden="true" />
                    {!isCollapsed && <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left">{item.label}</span>}
                    {!isCollapsed && <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />}
                  </button>
                  {isOpen && (
                    <div className={isCollapsed ? 'grid' : 'ml-4 space-y-1 border-l border-neutral-200 pl-3 dark:border-neutral-800'}>
                      {item.children!.map((child) => {
                        const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`)
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            title={isCollapsed ? child.label : undefined}
                            aria-label={isCollapsed ? child.label : undefined}
                            aria-current={childActive ? 'page' : undefined}
                            className={`grid pt-1 pb-1 items-center text-sm transition-colors ${isCollapsed ? 'h-9 grid-cols-[2.5rem] justify-items-center' : 'h-8 grid-cols-[1.75rem_minmax(0,1fr)]'} ${
                              childActive
                                ? 'bg-white text-neutral-950 shadow-sm dark:bg-neutral-950 dark:text-neutral-50'
                                : 'text-neutral-500 hover:bg-white hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-950 dark:hover:text-neutral-50'
                            }`}
                          >
                            <i className={`${child.icon} justify-self-center text-xs`} aria-hidden="true" />
                            {!isCollapsed && <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left">{child.label}</span>}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

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
