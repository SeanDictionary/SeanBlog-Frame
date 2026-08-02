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
    {
      key: 'articles',
      label: '全部文章',
      value: articles,
      icon: 'fa-regular fa-file-lines',
      status: `${drafts} 篇草稿待完善`,
      description: '文章库当前收录的全部内容，草稿和已发布文章会统一计入总数。',
      details: [
        { label: '草稿', value: `${drafts} 篇` },
        { label: '非草稿', value: `${articles - drafts} 篇` },
      ],
    },
    {
      key: 'drafts',
      label: '草稿',
      value: drafts,
      icon: 'fa-regular fa-pen-to-square',
      status: drafts > 0 ? '等待继续编辑' : '当前没有草稿',
      description: '尚未完成发布的文章。可以在文章管理中继续编辑、预览或发布。',
      details: [
        { label: '全部文章', value: `${articles} 篇` },
        { label: '草稿占比', value: articles > 0 ? `${Math.round((drafts / articles) * 100)}%` : '0%' },
      ],
    },
    {
      key: 'pendingComments',
      label: '待审核评论',
      value: pendingComments,
      icon: 'fa-regular fa-comments',
      status: pendingComments > 0 ? '需要人工审核' : '已全部处理',
      description: '待审核的读者评论会在通过前保持隐藏，完成审核后才会公开显示。',
      details: [
        { label: '待审核', value: `${pendingComments} 条` },
        { label: '处理状态', value: pendingComments > 0 ? '待处理' : '已清零' },
      ],
    },
    {
      key: 'media',
      label: '媒体文件',
      value: media,
      icon: 'fa-regular fa-images',
      status: media > 0 ? '媒体库可用' : '等待上传文件',
      description: '已上传并可在文章中引用的媒体文件，包括文章头图和正文插图。',
      details: [
        { label: '文件总数', value: `${media} 个` },
        { label: '媒体库状态', value: media > 0 ? '已有内容' : '空' },
      ],
    },
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
