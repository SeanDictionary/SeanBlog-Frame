import Link from 'next/link'
import type { Route } from 'next'
import type { Session } from 'next-auth'

import { signOut } from '@/lib/auth'

const adminNavigation: Array<{ href: Route; label: string; icon: string }> = [
  { href: '/admin', label: '概览', icon: 'fa-solid fa-chart-line' },
  { href: '/admin/articles', label: '文章', icon: 'fa-regular fa-file-lines' },
  { href: '/admin/categories', label: '分类', icon: 'fa-solid fa-folder-tree' },
  { href: '/admin/tags', label: '标签', icon: 'fa-solid fa-tags' },
  { href: '/admin/comments', label: '评论', icon: 'fa-regular fa-comments' },
  { href: '/admin/media', label: '媒体', icon: 'fa-regular fa-images' },
  { href: '/admin/settings', label: '设置', icon: 'fa-solid fa-sliders' },
]

type AdminSidebarProps = {
  session: Session
}

export function AdminSidebar({ session }: AdminSidebarProps) {
  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col border-r border-neutral-200 bg-white px-4 py-5 dark:border-neutral-800 dark:bg-neutral-950">
      <Link href="/admin" className="px-3 text-lg font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
        SeanBlog <span className="font-normal text-neutral-400">Admin</span>
      </Link>

      <nav className="mt-10 space-y-1" aria-label="后台导航">
        {adminNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
          >
            <i className={`${item.icon} w-4 text-center`} aria-hidden="true" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto border-t border-neutral-200 px-3 pt-5 text-sm dark:border-neutral-800">
        <p className="truncate font-medium text-neutral-800 dark:text-neutral-200">{session.user.name ?? '管理员'}</p>
        <Link href="/" className="mt-3 inline-flex items-center gap-2 text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">
          <i className="fa-solid fa-arrow-up-right-from-square text-xs" aria-hidden="true" />
          查看网站
        </Link>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/' })
          }}
          className="mt-4"
        >
          <button type="submit" className="inline-flex items-center gap-2 text-neutral-500 transition-colors hover:text-red-600 dark:hover:text-red-400">
            <i className="fa-solid fa-arrow-right-from-bracket text-xs" aria-hidden="true" />
            退出登录
          </button>
        </form>
      </div>
    </aside>
  )
}
