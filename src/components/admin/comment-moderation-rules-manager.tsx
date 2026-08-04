'use client'

import { useState, useTransition } from 'react'

import { COMMENT_MODERATION_RULES_SETTING_KEY, parseCommentBlacklistText, type CommentModerationRules } from '@/lib/comment-moderation-rules'

type ApiResponse = {
  error?: { message?: string }
  setting?: { value: unknown }
}

type CommentModerationRulesManagerProps = {
  initialRules: CommentModerationRules
}

export function CommentModerationRulesManager({ initialRules }: CommentModerationRulesManagerProps) {
  const [rules, setRules] = useState(initialRules)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save(formData: FormData) {
    const nextRules: CommentModerationRules = {
      autoApprove: formData.get('autoApprove') === 'on',
      blacklist: parseCommentBlacklistText(String(formData.get('blacklist') ?? '')),
    }

    startTransition(async () => {
      setMessage(null)

      try {
        const response = await fetch(`/api/admin/settings/${COMMENT_MODERATION_RULES_SETTING_KEY}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: nextRules }),
        })
        const data = (await response.json()) as ApiResponse

        if (!response.ok || !data.setting) {
          throw new Error(data.error?.message ?? '保存失败。')
        }

        setRules(nextRules)
        setMessage('评论自动审批规则已保存。')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '保存失败。')
      }
    })
  }

  return (
    <section className="mb-7 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">自动审批规则</h2>
          <p className="mt-1 text-sm text-neutral-500">开启后，未命中黑名单的新评论会自动通过；命中黑名单的评论会直接标记为垃圾评论。</p>
        </div>
        {message && <p className="text-sm text-neutral-500" role="status">{message}</p>}
      </div>

      <form action={save} className="mt-5 grid gap-4">
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input name="autoApprove" type="checkbox" defaultChecked={rules.autoApprove} />
          自动通过非黑名单评论
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          黑名单关键词
          <textarea
            name="blacklist"
            defaultValue={rules.blacklist.join('\n')}
            rows={4}
            placeholder="每行一个关键词，例如：垃圾广告"
            className="rounded-md border border-neutral-300 bg-white p-3 font-normal leading-6 outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400"
          />
          <span className="text-xs font-normal text-neutral-500">会同时匹配评论内容、昵称和邮箱；也支持用逗号分隔。</span>
        </label>
        <div>
          <button disabled={isPending} type="submit" className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">
            {isPending ? '正在保存…' : '保存规则'}
          </button>
        </div>
      </form>
    </section>
  )
}
