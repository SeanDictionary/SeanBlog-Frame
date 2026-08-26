'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import type { Route } from 'next'

import { useAdminToast } from '@/components/admin/admin-toast-provider'
import { ExternalLink } from '@/components/common/external-link'

type Comment = {
  id: string
  content: string
  status: 'PENDING' | 'APPROVED' | 'SPAM' | 'TRASHED'
  guestName: string | null
  guestEmail: string | null
  guestLink: string | null
  visitorId: string | null
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
  SPAM: { idle: '垃圾', pending: '正在标记…', success: '已标记为垃圾评论。' },
  TRASHED: { idle: '回收站', pending: '正在移至回收站…', success: '已移至回收站。' },
  PENDING: { idle: '待审核', pending: '正在恢复…', success: '已恢复为待审核。' },
  DELETE: { idle: '彻底删除', pending: '正在删除…', success: '已彻底删除评论。' },
}

type BulkAction = Comment['status'] | 'DELETE'

const bulkActions: Array<{ status: BulkAction; label: string; confirm?: string }> = [
  { status: 'APPROVED', label: '批量通过' },
  { status: 'SPAM', label: '批量标记垃圾' },
  { status: 'PENDING', label: '批量待审核' },
  { status: 'TRASHED', label: '批量移至回收站', confirm: '确认将选中的评论移至回收站吗？' },
  { status: 'DELETE', label: '批量删除', confirm: '确认删除选中的评论吗？该操作不可撤销。' },
]

export function CommentModeration({ initialComments, emptyMessage = '当前没有评论。' }: CommentModerationProps) {
  const [comments, setComments] = useState(initialComments)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeAction, setActiveAction] = useState<{ id: string; action: CommentAction } | null>(null)
  const [activeBulkAction, setActiveBulkAction] = useState<BulkAction | null>(null)
  const [isPending, startTransition] = useTransition()
  const toast = useAdminToast()
  const allSelected = comments.length > 0 && selectedIds.length === comments.length

  useEffect(() => {
    setComments(initialComments)
    setSelectedIds([])
    setActiveAction(null)
    setActiveBulkAction(null)
  }, [initialComments])

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
        toast.success(actionCopy[status].success)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '更新失败。')
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
        toast.success(`已${action?.label.replace('批量', '') ?? '处理'} ${count} 条评论。`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '批量操作失败。')
      } finally {
        setActiveBulkAction(null)
      }
    })
  }

  return (
    <div className="space-y-4">
      {comments.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950">
          <label className="inline-flex items-center gap-2 font-medium">
            <input type="checkbox" checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
            已选 {selectedIds.length} / {comments.length} 条
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions.map((action) => (
              <button
                key={action.status}
                type="button"
                disabled={isPending || selectedIds.length === 0}
                onClick={() => updateSelected(action.status)}
                className={action.status === 'DELETE' ? 'rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50 dark:border-red-900/70' : 'rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700'}
              >
                {activeBulkAction === action.status ? '处理中…' : action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {comments.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-3 text-left"><input type="checkbox" checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} aria-label="选择当前页全部评论" /></th>
                  <th className="px-4 py-3 text-left font-medium">评论内容</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                {comments.map((comment) => {
                  const isSelected = selectedIds.includes(comment.id)

                  return (
                    <tr
                      key={comment.id}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/70 dark:bg-blue-950/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60'}`}
                      onClick={() => toggleSelected(comment.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          toggleSelected(comment.id)
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className="w-12 px-4 py-5 align-top"><input type="checkbox" checked={isSelected} onChange={() => toggleSelected(comment.id)} aria-label={`选择 ${comment.guestName || '访客'} 的评论`} onClick={(event) => event.stopPropagation()} /></td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {
                                /^https?:\/\//i.test(comment.guestLink ?? '') ? (
                                  <ExternalLink href={comment.guestLink ?? ''} className="font-medium text-neutral-950 dark:text-neutral-50 transition-colors hover:text-blue-600 dark:hover:text-blue-300">
                                    {comment.guestEmail || '匿名评论'} <i className="fa-solid fa-arrow-up-right-from-square text-[0.625rem]" aria-hidden="true" />
                                  </ExternalLink>
                                ) : (
                                  <span className="font-medium text-neutral-950 dark:text-neutral-50">{comment.guestName || '匿名访客'}</span>
                                )
                              }
                              <span className="text-xs text-neutral-500">{comment.guestEmail || '匿名评论'}</span>
                              {comment.visitorId && (
                                <Link href={`/admin/visitors/${comment.visitorId}` as Route} className="text-xs text-neutral-950 dark:text-neutral-50 transition-colors hover:text-blue-600 dark:hover:text-blue-300" title={comment.visitorId}>{comment.visitorId.slice(0, 8)}…</Link>
                              )}

                            </div>
                            <p className="mt-1 text-xs text-neutral-500">{comment.article?.title ?? '已删除文章'} · {comment.createdAt.toLocaleString('zh-CN')}</p>
                            <p className="mt-3 whitespace-pre-wrap leading-6 text-neutral-700 dark:text-neutral-300">{comment.content}</p>
                          </div>

                          <div className="flex flex-col items-start gap-4 lg:items-end">
                            <StatusBadge status={comment.status} />
                            <div className="flex shrink-0 flex-wrap justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                              <ActionButtonList
                                status={comment.status}
                                pendingAction={(action) => isActionPending(comment.id, action)}
                                disabled={isPending}
                                onAction={(action) => update(comment.id, action)}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : <div className="rounded-lg border border-dashed border-neutral-300 px-5 py-16 text-center text-sm text-neutral-500 dark:border-neutral-700">{emptyMessage}</div>}
    </div>
  )
}

const commentActionsByStatus = {
  PENDING: ['APPROVED', 'SPAM', 'TRASHED'],
  APPROVED: ['PENDING', 'SPAM', 'TRASHED'],
  SPAM: ['APPROVED', 'PENDING', 'TRASHED'],
  TRASHED: ['APPROVED', 'PENDING', 'SPAM'],
} satisfies Record<Comment['status'], Comment['status'][]>

function ActionButtonList({
  status,
  pendingAction,
  disabled,
  onAction,
}: {
  status: Comment['status']
  pendingAction: (action: Comment['status']) => boolean
  disabled: boolean
  onAction: (action: Comment['status']) => void
}) {
  return (
    <>
      {commentActionsByStatus[status].map((action) => (
        <ActionButton key={action} action={action} pending={pendingAction(action)} disabled={disabled} onClick={() => onAction(action)} className="" />
      ))}
    </>
  )
}

function ActionButton({ action, pending, disabled, onClick, className }: { action: CommentAction; pending: boolean; disabled: boolean; onClick: () => void; className: string }) {
  const copy = actionCopy[action]
  const toneStyles: Record<CommentAction, string> = {
    APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-200',
    SPAM: 'border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-300 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-900/70 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:border-orange-700 dark:hover:bg-orange-900/60 dark:hover:text-orange-200',
    PENDING: 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:border-amber-700 dark:hover:bg-amber-900/60 dark:hover:text-amber-200',
    TRASHED: 'border-neutral-300 bg-neutral-100 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200',
    DELETE: 'border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 hover:text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300 dark:hover:border-red-700 dark:hover:bg-red-900/60 dark:hover:text-red-200',
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ease-out ${toneStyles[action]} ${className}`}
    >
      {pending && <i className="fa-solid fa-spinner fa-spin text-[0.65rem]" aria-hidden="true" />}
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
