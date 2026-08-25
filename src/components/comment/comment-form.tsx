'use client'

import { useState, useTransition, type FormEvent } from 'react'

import { getVisitorId } from '@/lib/client/identity'

type CommentFormProps = {
  articleId: string
  parentId?: string
  onCancel?: () => void
}

type CommentApiError = {
  error?: {
    message?: string
    issues?: Array<{ path?: (string | number)[]; message?: string }>
  }
}

const FIELD_LABELS: Record<string, string> = {
  guestEmail: '邮箱',
  guestName: '昵称',
  guestLink: '链接',
  content: '评论内容',
  articleId: '文章',
  parentId: '父评论',
}

// Turn the API's generic "Request validation failed." into a concrete, field-
// level hint so the visitor knows what to fix instead of staring at a 400.
function resolveErrorMessage(data: CommentApiError, fallback: string) {
  const issues = data.error?.issues
  if (Array.isArray(issues) && issues.length > 0) {
    return issues
      .map((issue) => {
        const field = issue.path?.[0]
        if (field === 'guestEmail') {
          return '邮箱格式不正确，请检查后重试。'
        }
        if (field === 'guestLink') {
          return '链接格式不正确，需以 http:// 或 https:// 开头。'
        }
        if (field === 'content') {
          return '评论内容不能为空或超过长度限制。'
        }
        const label = field && FIELD_LABELS[field] ? FIELD_LABELS[field] : null
        const detail = issue.message || '输入有误'
        return label ? `${label}：${detail}` : detail
      })
      .filter(Boolean)
      .join('；')
  }

  return data.error?.message ?? fallback
}

export function CommentForm({ articleId, parentId, onCancel }: CommentFormProps) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // preventDefault keeps the form from reloading and — importantly — opts
    // out of React 19's <form action> auto-reset, so a failed submission does
    // not wipe the visitor's already-typed content. We reset explicitly only
    // after a successful save.
    event.preventDefault()
    setMessage(null)

    const form = event.currentTarget
    const formData = new FormData(form)
    const content = String(formData.get('content') ?? '').trim()
    const guestName = String(formData.get('guestName') ?? '').trim()
    const guestEmail = String(formData.get('guestEmail') ?? '').trim()
    const guestLink = String(formData.get('guestLink') ?? '').trim()

    startTransition(async () => {
      try {
        const response = await fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articleId,
            ...(parentId ? { parentId } : {}),
            content,
            ...(guestName ? { guestName } : {}),
            ...(guestEmail ? { guestEmail } : {}),
            ...(guestLink ? { guestLink } : {}),
            visitorId: getVisitorId(),
          }),
        })

        const data = (await response.json()) as CommentApiError

        if (!response.ok) {
          throw new Error(resolveErrorMessage(data, '评论提交失败。'))
        }

        setMessage('评论已提交，审核通过后会显示在这里。')
        form.reset()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '评论提交失败，请稍后再试。')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} id={parentId ? `reply-form-${parentId}` : 'comment-form'} className="space-y-4 rounded-(--radius) border border-border bg-bg-secondary p-5">
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
        <span>链接 <span className="text-text-tertiary">（可选，点击昵称时新标签打开）</span></span>
        <input name="guestLink" type="url" maxLength={2048} placeholder="https://" className="h-10 rounded-sm border border-border bg-bg px-3 text-text outline-none transition-colors focus:border-accent" />
      </label>

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
