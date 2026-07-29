import { getPrisma } from '@/lib/prisma'

export default async function AdminDashboardPage() {
  const [articles, drafts, pendingComments, media] = await Promise.all([
    getPrisma().article.count(),
    getPrisma().article.count({ where: { status: 'DRAFT' } }),
    getPrisma().comment.count({ where: { status: 'PENDING' } }),
    getPrisma().media.count(),
  ])

  const stats = [
    { label: '全部文章', value: articles, icon: 'fa-regular fa-file-lines' },
    { label: '草稿', value: drafts, icon: 'fa-regular fa-pen-to-square' },
    { label: '待审核评论', value: pendingComments, icon: 'fa-regular fa-comments' },
    { label: '媒体文件', value: media, icon: 'fa-regular fa-images' },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-10">
        <p className="mb-2 text-sm text-neutral-500">后台概览</p>
        <h1 className="text-3xl font-semibold tracking-tight">欢迎回来</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <section key={stat.label} className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
            <i className={`${stat.icon} text-neutral-400`} aria-hidden="true" />
            <p className="mt-5 text-3xl font-semibold">{stat.value}</p>
            <p className="mt-1 text-sm text-neutral-500">{stat.label}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
