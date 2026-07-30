'use client'

import { useState, useTransition } from 'react'

type CommentFormProps = {
  articleId: string
  parentId?: string
  onCancel?: () => void
}

export function CommentForm({ articleId, parentId, onCancel }: CommentFormProps) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit(formData: FormData) {
    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articleId,
            parentId,
            content: formData.get('content'),
            guestName: formData.get('guestName') || undefined,
            guestEmail: formData.get('guestEmail') || undefined,
          }),
        })

        const data = (await response.json()) as { error?: { message?: string } }

        if (!response.ok) {
          throw new Error(data.error?.message ?? '评论提交失败。')
        }

        setMessage('评论已提交，审核通过后会显示在这里。')
        const form = document.getElementById(parentId ? `reply-form-${parentId}` : 'comment-form') as HTMLFormElement | null
        form?.reset()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '评论提交失败，请稍后再试。')
      }
    })
  }

  return (
    <form id={parentId ? `reply-form-${parentId}` : 'comment-form'} action={submit} className="space-y-4 rounded-(--radius) border border-border bg-bg-secondary p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm text-text-secondary">
          昵称
          <input name="guestName" maxLength={120} className="h-10 rounded-sm border border-border bg-bg px-3 text-text outline-none transition-colors focus:border-accent" />
        </label>
        <label className="grid gap-1.5 text-sm text-text-secondary">
          <span>邮箱 <span className="text-text-tertiary">（不公开）</span></span>
          <input name="guestEmail" type="email" maxLength={320} className="h-10 rounded-sm border border-border bg-bg px-3 text-text outline-none transition-colors focus:border-accent" />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm text-text-secondary">
        {parentId ? '回复内容' : '发表评论'}
        <textarea name="content" required minLength={1} maxLength={5000} rows={5} className="resize-y rounded-sm border border-border bg-bg p-3 text-text outline-none transition-colors focus:border-accent" />
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">
          {isPending ? '正在提交…' : '提交评论'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="text-sm text-text-secondary transition-colors hover:text-text">取消</button>}
      </div>

      {message && <p className="text-sm text-text-secondary" role="status">{message}</p>}
    </form>
  )
}
