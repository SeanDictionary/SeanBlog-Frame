import { CommentModeration } from '@/components/admin/comment-moderation'
import { listComments } from '@/lib/services/comment-service'

export default async function AdminCommentsPage() {
  const result = await listComments({ page: 1, pageSize: 100 })

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8"><p className="mb-2 text-sm text-neutral-500">互动管理</p><h1 className="text-3xl font-semibold tracking-tight">评论</h1></header>
      <CommentModeration initialComments={result.items} />
    </div>
  )
}
