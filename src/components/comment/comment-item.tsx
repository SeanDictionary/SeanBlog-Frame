'use client'

import { useState } from 'react'

import { ExternalLink } from '@/components/common/external-link'
import { CommentForm } from '@/components/comment/comment-form'

type Comment = {
  id: string
  content: string
  guestName: string | null
  guestLink: string | null
  createdAt: Date
  parentId: string | null
}

type CommentWithReplies = Comment & {
  replies: Comment[]
}

type CommentItemProps = {
  articleId: string
  comment: CommentWithReplies | Comment
  canReply?: boolean
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

// Only render a visitor-provided link when it is an http(s) URL. The API
// already rejects anything else, but this guards against stale or directly-
// inserted data so a `javascript:` value can never reach an href.
function isSafeLink(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

export function CommentItem({ articleId, comment, canReply = false }: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false)

  return (
    <article className="border-t border-border py-6 first:border-t-0">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-bg-tertiary text-xs font-semibold text-text-secondary">
            {(comment.guestName?.trim().charAt(0) || '访').toLocaleUpperCase()}
          </span>
          {isSafeLink(comment.guestLink) ? (
            <ExternalLink href={comment.guestLink} ariaLabel={`${comment.guestName || '访客'} 的个人链接`} className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-accent">
              <span>{comment.guestName || '访客'}</span>
              <i className="fa-solid fa-arrow-up-right-from-square text-[0.625rem] text-text-tertiary" aria-hidden="true" />
            </ExternalLink>
          ) : (
            <span className="font-medium">{comment.guestName || '访客'}</span>
          )}
        </div>
        <time className="text-xs text-text-tertiary" dateTime={comment.createdAt.toISOString()}>
          {formatDate(comment.createdAt)}
        </time>
      </header>

      <p className="mt-3 whitespace-pre-wrap leading-7 text-text-secondary">{comment.content}</p>

      {canReply && (
        <button type="button" onClick={() => setIsReplying((value) => !value)} className="mt-3 text-sm text-text-secondary transition-colors hover:text-accent">
          {isReplying ? '收起回复' : '回复'}
        </button>
      )}

      {isReplying && <div className="mt-4"><CommentForm articleId={articleId} parentId={comment.id} onCancel={() => setIsReplying(false)} /></div>}

      {'replies' in comment && comment.replies.length > 0 && (
        <div className="mt-5 border-l border-border pl-5">
          {comment.replies.map((reply) => <CommentItem key={reply.id} articleId={articleId} comment={reply} />)}
        </div>
      )}
    </article>
  )
}
