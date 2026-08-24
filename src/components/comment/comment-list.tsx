import { CommentForm } from '@/components/comment/comment-form'
import { CommentItem } from '@/components/comment/comment-item'
import type { ArticleCommentsMode } from '@/lib/comment-settings'

type Comment = {
  id: string
  content: string
  guestName: string | null
  guestLink: string | null
  createdAt: Date
  parentId: string | null
  replies: Array<{
    id: string
    content: string
    guestName: string | null
    guestLink: string | null
    createdAt: Date
    parentId: string | null
  }>
}

type CommentListProps = {
  articleId: string
  comments: Comment[]
  mode: ArticleCommentsMode
}

export function CommentList({ articleId, comments, mode }: CommentListProps) {
  if (mode === 'disabled') {
    return null
  }

  const acceptsNewComments = mode === 'enabled'

  return (
    <section className="mt-16 border-t border-border pt-10" aria-labelledby="comments-heading">
      <div className="mb-7 flex items-baseline justify-between">
        <h2 id="comments-heading" className="text-2xl font-semibold tracking-[-0.03em]">评论</h2>
        <span className="font-mono text-xs text-text-tertiary">{comments.length} 条已公开</span>
      </div>

      {acceptsNewComments ? <CommentForm articleId={articleId} /> : (
        <p className="rounded-(--radius) border border-border bg-bg-secondary px-5 py-4 text-sm text-text-secondary">当前文章暂不接受新评论。</p>
      )}

      {comments.length > 0 ? (
        <div className="mt-8">
          {comments.map((comment) => <CommentItem key={comment.id} articleId={articleId} comment={comment} canReply={acceptsNewComments} />)}
        </div>
      ) : (
        <p className="mt-8 border-t border-border py-7 text-sm text-text-secondary">还没有公开评论，欢迎留下第一条想法。</p>
      )}
    </section>
  )
}
