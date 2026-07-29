import { CommentForm } from '@/components/comment/comment-form'
import { CommentItem } from '@/components/comment/comment-item'

type Comment = {
  id: string
  content: string
  guestName: string | null
  createdAt: Date
  parentId: string | null
  replies: Array<{
    id: string
    content: string
    guestName: string | null
    createdAt: Date
    parentId: string | null
  }>
}

type CommentListProps = {
  articleId: string
  comments: Comment[]
}

export function CommentList({ articleId, comments }: CommentListProps) {
  return (
    <section className="mt-16 border-t border-border pt-10" aria-labelledby="comments-heading">
      <div className="mb-7 flex items-baseline justify-between">
        <h2 id="comments-heading" className="text-2xl font-semibold tracking-[-0.03em]">评论</h2>
        <span className="font-mono text-xs text-text-tertiary">{comments.length} 条已公开</span>
      </div>

      <CommentForm articleId={articleId} />

      {comments.length > 0 ? (
        <div className="mt-8">
          {comments.map((comment) => <CommentItem key={comment.id} articleId={articleId} comment={comment} canReply />)}
        </div>
      ) : (
        <p className="mt-8 border-t border-border py-7 text-sm text-text-secondary">还没有公开评论，欢迎留下第一条想法。</p>
      )}
    </section>
  )
}
