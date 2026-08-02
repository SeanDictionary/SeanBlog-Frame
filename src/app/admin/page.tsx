import { DashboardManager } from '@/components/admin/dashboard-manager'
import { getPrisma } from '@/lib/prisma'
import { getSiteSettingsMap } from '@/lib/services/setting-service'

export default async function AdminDashboardPage() {
  const [articles, drafts, pendingComments, media, settings] = await Promise.all([
    getPrisma().article.count(),
    getPrisma().article.count({ where: { status: 'DRAFT' } }),
    getPrisma().comment.count({ where: { status: 'PENDING' } }),
    getPrisma().media.count(),
    getSiteSettingsMap(),
  ])

  const stats = [
    { key: 'articles', label: '全部文章', value: articles, icon: 'fa-regular fa-file-lines' },
    { key: 'drafts', label: '草稿', value: drafts, icon: 'fa-regular fa-pen-to-square' },
    { key: 'pendingComments', label: '待审核评论', value: pendingComments, icon: 'fa-regular fa-comments' },
    { key: 'media', label: '媒体文件', value: media, icon: 'fa-regular fa-images' },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-10">
        <p className="mb-2 text-sm text-neutral-500">后台概览</p>
        <h1 className="text-3xl font-semibold tracking-tight">欢迎回来</h1>
      </header>

      <DashboardManager cards={stats} initialLayout={settings.adminDashboardCards} />
    </div>
  )
}
