'use client'

import { useState, useTransition } from 'react'

type Comment = {
  id: string
  content: string
  status: 'PENDING' | 'APPROVED' | 'SPAM' | 'TRASHED'
  guestName: string | null
  guestEmail: string | null
  isSpam: boolean
  createdAt: Date
  article?: { id: string; title: string; slug: string }
}

type CommentModerationProps = {
  initialComments: Comment[]
  emptyMessage?: string
}

export function CommentModeration({ initialComments, emptyMessage = '当前没有评论。' }: CommentModerationProps) {
  const [comments, setComments] = useState(initialComments)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function update(id: string, status: Comment['status']) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/comments/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        const data = (await response.json()) as { comment?: Partial<Comment>; error?: { message?: string } }
        if (!response.ok || !data.comment) throw new Error(data.error?.message ?? '更新失败。')
        setComments((previous) => previous.map((comment) => comment.id === id ? { ...comment, ...data.comment } : comment))
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '更新失败。')
      }
    })
  }

  function purge(id: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/comments/${id}`, { method: 'DELETE' })
        if (!response.ok) throw new Error('删除失败。')
        setComments((previous) => previous.filter((comment) => comment.id !== id))
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '删除失败。')
      }
    })
  }

  return (
    <div className="space-y-4">
      {comments.length > 0 ? comments.map((comment) => (
        <article key={comment.id} className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{comment.guestName || '访客'} <span className="font-normal text-neutral-500">{comment.guestEmail}</span></p><p className="mt-1 text-xs text-neutral-500">{comment.article?.title ?? '已删除文章'} · {comment.createdAt.toLocaleString('zh-CN')}</p></div><StatusBadge status={comment.status} /></header>
          <p className="mt-4 whitespace-pre-wrap leading-7 text-neutral-700 dark:text-neutral-300">{comment.content}</p>
          <footer className="mt-5 flex flex-wrap gap-3 text-sm"><button type="button" disabled={isPending} onClick={() => update(comment.id, 'APPROVED')} className="text-green-700 dark:text-green-400">通过</button><button type="button" disabled={isPending} onClick={() => update(comment.id, 'SPAM')} className="text-amber-700 dark:text-amber-400">标记垃圾</button><button type="button" disabled={isPending} onClick={() => update(comment.id, 'TRASHED')} className="text-neutral-500">移至回收站</button><button type="button" disabled={isPending} onClick={() => purge(comment.id)} className="text-red-600">彻底删除</button></footer>
        </article>
      )) : <div className="rounded-lg border border-dashed border-neutral-300 px-5 py-16 text-center text-sm text-neutral-500 dark:border-neutral-700">{emptyMessage}</div>}
      {message && <p className="text-sm text-red-600" role="status">{message}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: Comment['status'] }) {
  const copy = { PENDING: '待审核', APPROVED: '已通过', SPAM: '垃圾', TRASHED: '回收站' }[status]
  return <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">{copy}</span>
}
