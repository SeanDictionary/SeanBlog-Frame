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

type CommentAction = Comment['status'] | 'DELETE'

const actionCopy: Record<CommentAction, { idle: string; pending: string; success: string }> = {
  APPROVED: { idle: '通过', pending: '正在通过…', success: '已通过评论。' },
  SPAM: { idle: '标记垃圾', pending: '正在标记…', success: '已标记为垃圾评论。' },
  TRASHED: { idle: '移至回收站', pending: '正在移至回收站…', success: '已移至回收站。' },
  PENDING: { idle: '恢复待审核', pending: '正在恢复…', success: '已恢复为待审核。' },
  DELETE: { idle: '彻底删除', pending: '正在删除…', success: '已彻底删除评论。' },
}

type BulkAction = Comment['status'] | 'DELETE'

const bulkActions: Array<{ status: BulkAction; label: string; confirm?: string }> = [
  { status: 'APPROVED', label: '批量通过' },
  { status: 'SPAM', label: '批量标记垃圾' },
  { status: 'PENDING', label: '批量恢复待审核' },
  { status: 'TRASHED', label: '批量移至回收站', confirm: '确认将选中的评论移至回收站吗？' },
  { status: 'DELETE', label: '批量彻底删除', confirm: '确认彻底删除选中的评论吗？该操作不可撤销。' },
]

export function CommentModeration({ initialComments, emptyMessage = '当前没有评论。' }: CommentModerationProps) {
  const [comments, setComments] = useState(initialComments)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<{ id: string; action: CommentAction } | null>(null)
  const [activeBulkAction, setActiveBulkAction] = useState<BulkAction | null>(null)
  const [isPending, startTransition] = useTransition()
  const allSelected = comments.length > 0 && selectedIds.length === comments.length

  function isActionPending(id: string, action: CommentAction) {
    return activeAction?.id === id && activeAction.action === action
  }

  function toggleSelected(id: string) {
    setSelectedIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id])
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? comments.map((comment) => comment.id) : [])
  }

  function updateLocalComments(ids: string[], status: Comment['status']) {
    setComments((previous) => previous.map((comment) => ids.includes(comment.id) ? { ...comment, status, isSpam: status === 'SPAM' } : comment))
  }

  function update(id: string, status: Comment['status']) {
    setMessage(null)
    setActiveAction({ id, action: status })

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
        setMessage(actionCopy[status].success)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '更新失败。')
      } finally {
        setActiveAction(null)
      }
    })
  }

  function updateSelected(status: BulkAction) {
    if (selectedIds.length === 0) return

    const action = bulkActions.find((item) => item.status === status)
    if (action?.confirm && !window.confirm(action.confirm)) return

    const ids = [...selectedIds]
    setMessage(null)
    setActiveBulkAction(status)

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/comments/bulk', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, status }),
        })
        const data = (await response.json()) as { count?: number; error?: { message?: string } }
        if (!response.ok) throw new Error(data.error?.message ?? '批量操作失败。')

        const count = data.count ?? ids.length
        if (status === 'DELETE') {
          setComments((previous) => previous.filter((comment) => !ids.includes(comment.id)))
        } else {
          updateLocalComments(ids, status)
        }
        setSelectedIds([])
        setMessage(`已${action?.label.replace('批量', '') ?? '处理'} ${count} 条评论。`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '批量操作失败。')
      } finally {
        setActiveBulkAction(null)
      }
    })
  }

  function purge(id: string) {
    if (!window.confirm('确认彻底删除这条评论吗？该操作不可撤销。')) return

    setMessage(null)
    setActiveAction({ id, action: 'DELETE' })

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/comments/${id}`, { method: 'DELETE' })
        if (!response.ok) throw new Error('删除失败。')
        setComments((previous) => previous.filter((comment) => comment.id !== id))
        setSelectedIds((previous) => previous.filter((item) => item !== id))
        setMessage(actionCopy.DELETE.success)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '删除失败。')
      } finally {
        setActiveAction(null)
      }
    })
  }

  return (
    <div className="space-y-4">
      {comments.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950">
          <label className="inline-flex items-center gap-2 font-medium">
            <input type="checkbox" checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
            全选当前 {comments.length} 条
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-neutral-500">已选 {selectedIds.length} 条</span>
            {bulkActions.map((action) => (
              <button
                key={action.status}
                type="button"
                disabled={isPending || selectedIds.length === 0}
                onClick={() => updateSelected(action.status)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-neutral-700 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200"
              >
                {activeBulkAction === action.status ? '处理中…' : action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {comments.length > 0 ? comments.map((comment) => (
        <article key={comment.id} className={`rounded-lg border bg-white p-5 dark:bg-neutral-950 ${selectedIds.includes(comment.id) ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-950' : 'border-neutral-200 dark:border-neutral-800'}`}>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={selectedIds.includes(comment.id)} onChange={() => toggleSelected(comment.id)} aria-label="选择评论" className="mt-1" />
              <div><p className="font-medium">{comment.guestName || '访客'} <span className="font-normal text-neutral-500">{comment.guestEmail}</span></p><p className="mt-1 text-xs text-neutral-500">{comment.article?.title ?? '已删除文章'} · {comment.createdAt.toLocaleString('zh-CN')}</p></div>
            </div>
            <StatusBadge status={comment.status} />
          </header>
          <p className="mt-4 whitespace-pre-wrap leading-7 text-neutral-700 dark:text-neutral-300">{comment.content}</p>
          <footer className="mt-5 flex flex-wrap gap-3 text-sm" aria-busy={activeAction?.id === comment.id}>
            <ActionButton action="APPROVED" pending={isActionPending(comment.id, 'APPROVED')} disabled={isPending} onClick={() => update(comment.id, 'APPROVED')} className="text-green-700 dark:text-green-400" />
            <ActionButton action="SPAM" pending={isActionPending(comment.id, 'SPAM')} disabled={isPending} onClick={() => update(comment.id, 'SPAM')} className="text-amber-700 dark:text-amber-400" />
            <ActionButton action="TRASHED" pending={isActionPending(comment.id, 'TRASHED')} disabled={isPending} onClick={() => update(comment.id, 'TRASHED')} className="text-neutral-500" />
            <ActionButton action="DELETE" pending={isActionPending(comment.id, 'DELETE')} disabled={isPending} onClick={() => purge(comment.id)} className="text-red-600" />
          </footer>
        </article>
      )) : <div className="rounded-lg border border-dashed border-neutral-300 px-5 py-16 text-center text-sm text-neutral-500 dark:border-neutral-700">{emptyMessage}</div>}
      {message && <p className="text-sm text-neutral-500" role="status">{message}</p>}
    </div>
  )
}

function ActionButton({ action, pending, disabled, onClick, className }: { action: CommentAction; pending: boolean; disabled: boolean; onClick: () => void; className: string }) {
  const copy = actionCopy[action]

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1 transition-opacity disabled:cursor-wait disabled:opacity-60 ${className}`}>
      {pending && <i className="fa-solid fa-spinner fa-spin text-xs" aria-hidden="true" />}
      {pending ? copy.pending : copy.idle}
    </button>
  )
}

function StatusBadge({ status }: { status: Comment['status'] }) {
  const copy = { PENDING: '待审核', APPROVED: '已通过', SPAM: '垃圾', TRASHED: '回收站' }[status]
  const styles = {
    PENDING: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300',
    APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300',
    SPAM: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/70 dark:bg-orange-950/40 dark:text-orange-300',
    TRASHED: 'border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400',
  } satisfies Record<Comment['status'], string>
  const icons = {
    PENDING: 'fa-regular fa-clock',
    APPROVED: 'fa-solid fa-check',
    SPAM: 'fa-solid fa-triangle-exclamation',
    TRASHED: 'fa-regular fa-trash-can',
  } satisfies Record<Comment['status'], string>

  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}><i className={`${icons[status]} text-[0.65rem]`} aria-hidden="true" />{copy}</span>
}
