import { DashboardManager } from '@/components/admin/dashboard-manager'
import { getPrisma } from '@/lib/prisma'
import { getSiteSettingsMap } from '@/lib/services/setting-service'

function formatArticleDate(date: Date | null) {
  return date ? date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '未发布'
}

export default async function AdminDashboardPage() {
  const prisma = getPrisma()
  const [articles, drafts, pendingComments, media, latestArticles, popularArticles, settings] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: 'DRAFT' } }),
    prisma.comment.count({ where: { status: 'PENDING' } }),
    prisma.media.count(),
    prisma.article.findMany({
      where: { status: 'PUBLISHED', publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: { title: true, publishedAt: true },
    }),
    prisma.article.findMany({
      where: { status: 'PUBLISHED', publishedAt: { not: null } },
      orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
      take: 3,
      select: { title: true, viewCount: true },
    }),
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
      href: '/admin/articles' as const,
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
      href: '/admin/articles?status=DRAFT' as const,
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
      href: '/admin/comments?status=PENDING' as const,
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
      href: '/admin/media' as const,
    },
    {
      key: 'latestArticles',
      label: '最新文章',
      value: latestArticles.length,
      icon: 'fa-regular fa-clock',
      status: latestArticles.length > 0 ? '最近发布内容' : '尚无已发布文章',
      description: '最近发布的文章会显示在大尺寸卡片中，方便快速了解内容更新情况。',
      details: [
        { label: '展示数量', value: `${latestArticles.length} 篇` },
        { label: '排序方式', value: '发布时间' },
      ],
      listItems: latestArticles.map((article) => ({
        title: article.title,
        detail: formatArticleDate(article.publishedAt),
      })),
      href: '/admin/articles?status=PUBLISHED' as const,
    },
    {
      key: 'popularArticles',
      label: '最热文章',
      value: popularArticles[0]?.viewCount ?? 0,
      icon: 'fa-solid fa-fire',
      status: popularArticles.length > 0 ? '按历史浏览量排序' : '尚无已发布文章',
      description: '当前按文章累计浏览量排列。按时间范围的热度统计将在统计功能完成后接入。',
      details: [
        { label: '展示数量', value: `${popularArticles.length} 篇` },
        { label: '统计范围', value: '历史累计' },
      ],
      listItems: popularArticles.map((article) => ({
        title: article.title,
        detail: `${article.viewCount} 次阅读`,
      })),
      href: '/admin/articles?status=PUBLISHED' as const,
    },
    {
      key: 'siteAnalytics',
      label: '全站统计',
      icon: 'fa-solid fa-chart-pie',
      status: '统计功能待接入',
      description: '访问量、访客数、来源和趋势等统计指标将在后续的后台统计需求完成后显示。',
      details: [
        { label: '访问量', value: '待接入' },
        { label: '访客数', value: '待接入' },
      ],
    },
    {
      key: 'quickCreateArticle',
      label: '快速新建文章',
      value: '＋',
      icon: 'fa-solid fa-pen-to-square',
      status: '开始一篇新文章',
      description: '打开文章编辑器，开始撰写并保存新的文章内容。',
      details: [
        { label: '当前草稿', value: `${drafts} 篇` },
        { label: '下一步', value: '填写标题与正文' },
      ],
      href: '/admin/articles/new' as const,
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
