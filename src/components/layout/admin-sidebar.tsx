import type { Route } from 'next'
import type { Session } from 'next-auth'

import { getSiteSettingsMap } from '@/lib/services/setting-service'
import { signOut } from '@/lib/auth'
import { AdminSidebarClient } from '@/components/layout/admin-sidebar-client'

const adminNavigation: Array<{ href: Route; label: string; icon: string }> = [
  { href: '/admin', label: '概览', icon: 'fa-solid fa-chart-line' },
  { href: '/admin/articles', label: '文章', icon: 'fa-regular fa-file-lines' },
  { href: '/admin/taxonomy' as Route, label: '分类标签', icon: 'fa-solid fa-folder-tree' },
  { href: '/admin/comments', label: '评论', icon: 'fa-regular fa-comments' },
  { href: '/admin/analytics' as Route, label: '统计', icon: 'fa-solid fa-chart-simple' },
  { href: '/admin/personalization' as Route, label: '个性化', icon: 'fa-solid fa-palette' },
  { href: '/admin/media', label: '媒体', icon: 'fa-regular fa-images' },
  { href: '/admin/settings', label: '设置', icon: 'fa-solid fa-sliders' },
]

type AdminSidebarProps = {
  session: Session
}

export async function AdminSidebar({ session }: AdminSidebarProps) {
  const settings = await getSiteSettingsMap()
  const title = typeof settings.adminSidebarTitle === 'string' && settings.adminSidebarTitle.trim() ? settings.adminSidebarTitle : 'SeanBlog Admin'
  const showViewSite = settings.adminSidebarShowViewSite !== false

  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/' })
  }

  return <AdminSidebarClient navigation={adminNavigation} userName={session.user.name ?? '管理员'} title={title} showViewSite={showViewSite} signOutAction={signOutAction} />
}
