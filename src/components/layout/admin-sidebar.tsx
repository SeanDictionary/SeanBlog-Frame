import type { Route } from 'next'
import type { Session } from 'next-auth'

import { getSiteSettingsMapSafe } from '@/lib/services/setting-service'
import { signOut } from '@/lib/auth'
import { adminLogActor, recordOperationLog } from '@/lib/services/operation-log-service'
import { AdminSidebarClient } from '@/components/layout/admin-sidebar-client'

const adminNavigation: Array<{ href: Route; label: string; icon: string; children?: Array<{ href: Route; label: string; icon: string }> }> = [
  { href: '/admin', label: '概览', icon: 'fa-solid fa-chart-line' },
  { href: '/admin/articles', label: '文章', icon: 'fa-regular fa-file-lines' },
  {
    href: '/admin/taxonomy' as Route,
    label: '分类标签',
    icon: 'fa-solid fa-folder-tree',
    children: [
      { href: '/admin/categories' as Route, label: '分类', icon: 'fa-solid fa-folder' },
      { href: '/admin/tags' as Route, label: '标签', icon: 'fa-solid fa-tags' },
    ],
  },
  { href: '/admin/comments', label: '评论', icon: 'fa-regular fa-comments' },
  {
    href: '/admin/overview' as Route,
    label: '统计',
    icon: 'fa-solid fa-chart-simple',
    children: [
      { href: '/admin/overview' as Route, label: '总览', icon: 'fa-solid fa-chart-line' },
      { href: '/admin/visitors' as Route, label: '访客统计', icon: 'fa-solid fa-users-viewfinder' },
    ],
  },
  { href: '/admin/personalization' as Route, label: '个性化', icon: 'fa-solid fa-palette' },
  { href: '/admin/media', label: '媒体', icon: 'fa-regular fa-images' },
  { href: '/admin/logs' as Route, label: '日志', icon: 'fa-solid fa-list-check' },
  { href: '/admin/settings', label: '设置', icon: 'fa-solid fa-sliders' },
]

type AdminSidebarProps = {
  session: Session
}

export async function AdminSidebar({ session }: AdminSidebarProps) {
  const settings = await getSiteSettingsMapSafe()
  const siteName = typeof settings.siteName === 'string' && settings.siteName.trim() ? settings.siteName : 'SeanBlog'

  async function signOutAction() {
    'use server'
    await recordOperationLog({
      actor: adminLogActor(session),
      module: 'auth',
      action: 'logout',
      targetType: 'user',
      targetId: session.user.id,
      summary: `管理员退出登录：${session.user.name ?? '管理员'}`,
      result: 'SUCCESS',
    })
    await signOut({ redirectTo: '/' })
  }

  return <AdminSidebarClient navigation={adminNavigation} userName={session.user.name ?? '管理员'} siteName={siteName} signOutAction={signOutAction} />
}
