import { CommentStatus } from '@prisma/client'
import type { Route } from 'next'
import Link from 'next/link'

import { CommentModeration } from '@/components/admin/comment-moderation'
import { listComments } from '@/lib/services/comment-service'

const commentStatusLabels = {
  PENDING: '待审核',
  APPROVED: '已通过',
  SPAM: '垃圾',
  TRASHED: '回收站',
} satisfies Record<CommentStatus, string>

function getSelectedStatus(status: string | undefined) {
  return status && status in commentStatusLabels ? status as CommentStatus : undefined
}

export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: statusParam } = await searchParams
  const status = getSelectedStatus(statusParam)
  const result = await listComments({ page: 1, pageSize: 100, status })

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <p className="mb-2 text-sm text-neutral-500">互动管理</p>
        <h1 className="text-3xl font-semibold tracking-tight">评论</h1>
      </header>
      <nav className="mb-5 flex flex-wrap items-center gap-2" aria-label="评论状态筛选">
        <FilterLink href="/admin/comments" active={!status}>全部</FilterLink>
        {(Object.entries(commentStatusLabels) as Array<[CommentStatus, string]>).map(([value, label]) => (
          <FilterLink key={value} href={`/admin/comments?status=${value}`} active={status === value}>{label}</FilterLink>
        ))}
      </nav>
      <p className="mb-4 text-sm text-neutral-500">
        {status ? `当前仅显示${commentStatusLabels[status]}评论` : '当前显示全部评论'}，共 {result.meta.total} 条。
      </p>
      <CommentModeration initialComments={result.items} emptyMessage={status ? `当前没有${commentStatusLabels[status]}评论。` : undefined} />
    </div>
  )
}

function FilterLink({ href, active, children }: { href: Route; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950'
          : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
      }`}
    >
      {children}
    </Link>
  )
}
