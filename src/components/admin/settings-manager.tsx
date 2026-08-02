'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

type Setting = {
  id: string
  key: string
  value: unknown
}

type SettingsManagerProps = {
  initialSettings: Setting[]
  availableThemes: string[]
}

type ApiResponse = {
  error?: { message?: string }
}

function stringifyValue(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

export function SettingsManager({ initialSettings, availableThemes }: SettingsManagerProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [settings, setSettings] = useState(initialSettings)
  const [themes, setThemes] = useState(availableThemes)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const activeTheme = String(settings.find((setting) => setting.key === 'activeTheme')?.value ?? 'default')
  const showPublishedAt = settings.find((setting) => setting.key === 'articleMetaShowPublishedAt')?.value !== false
  const showViewCount = settings.find((setting) => setting.key === 'articleMetaShowViewCount')?.value !== false
  const showReadingTime = settings.find((setting) => setting.key === 'articleMetaShowReadingTime')?.value !== false
  const showWordCount = settings.find((setting) => setting.key === 'articleMetaShowWordCount')?.value !== false
  const showCategory = settings.find((setting) => setting.key === 'articleMetaShowCategory')?.value !== false
  const showTags = settings.find((setting) => setting.key === 'articleMetaShowTags')?.value !== false
  const commentsMode = String(settings.find((setting) => setting.key === 'articleCommentsMode')?.value ?? 'enabled')

  function reportError(error: unknown, fallback: string) {
    setMessage(error instanceof Error ? error.message : fallback)
  }

  function save(key: string, rawValue: string) {
    startTransition(async () => {
      setMessage(null)
      let value: unknown = rawValue

      try {
        value = JSON.parse(rawValue)
      } catch {
        // Plain strings are valid setting values.
      }

      try {
        const response = await fetch(`/api/admin/settings/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        })
        const data = (await response.json()) as ApiResponse & { setting?: Setting }

        if (!response.ok || !data.setting) {
          throw new Error(data.error?.message ?? '保存失败。')
        }

        setSettings((previous) => previous.some((setting) => setting.key === key)
          ? previous.map((setting) => setting.key === key ? data.setting! : setting)
          : [...previous, data.setting!])
        setMessage(`已保存 ${key}。`)
        router.refresh()
      } catch (error) {
        reportError(error, '保存失败。')
      }
    })
  }

  function importTheme(formData: FormData) {
    startTransition(async () => {
      setMessage(null)

      try {
        const response = await fetch('/api/admin/themes', { method: 'POST', body: formData })
        const data = (await response.json()) as ApiResponse & { theme?: string }

        if (!response.ok || !data.theme) {
          throw new Error(data.error?.message ?? '主题导入失败。')
        }

        setThemes((previous) => [...new Set([...previous, data.theme!])].sort((left, right) => left.localeCompare(right)))
        setMessage(`已导入主题 ${data.theme}。请选择并应用它以在前台启用。`)
        fileInputRef.current?.form?.reset()
        router.refresh()
      } catch (error) {
        reportError(error, '主题导入失败。')
      }
    })
  }

  function deleteTheme(theme: string) {
    startTransition(async () => {
      setMessage(null)

      try {
        const response = await fetch(`/api/admin/themes/${encodeURIComponent(theme)}`, { method: 'DELETE' })
        const data = response.status === 204 ? null : (await response.json()) as ApiResponse

        if (!response.ok) {
          throw new Error(data?.error?.message ?? '主题删除失败。')
        }

        setThemes((previous) => previous.filter((item) => item !== theme))
        setMessage(`已删除主题 ${theme}。`)
        router.refresh()
      } catch (error) {
        reportError(error, '主题删除失败。')
      }
    })
  }

  return (
    <div className="space-y-7">
      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="font-semibold">前台主题</h2>
        <p className="mt-1 text-sm text-neutral-500">主题仅影响前台页面。每个主题是只覆盖设计变量的 CSS 文件，自动跟随访客的系统浅色或深色偏好。</p>

        <form action={(formData) => save('activeTheme', String(formData.get('theme') ?? 'default'))} className="mt-5 flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-sm">
            当前主题
            <select key={activeTheme} name="theme" defaultValue={activeTheme} className="h-10 min-w-48 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900">
              {themes.map((theme) => <option key={theme} value={theme}>{theme}</option>)}
            </select>
          </label>
          <button disabled={isPending} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">应用主题</button>
        </form>

        <div className="mt-7 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <h3 className="text-sm font-semibold">导入主题 CSS</h3>
          <p className="mt-1 text-sm text-neutral-500">主题名使用小写字母、数字、连字符或下划线；CSS 最多 100 KB，只能声明受支持的设计变量。</p>
          <form action={importTheme} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5 text-sm">主题名<input name="name" required pattern="[a-z0-9][a-z0-9_-]{0,63}" maxLength={64} className="h-10 w-48 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
            <label className="grid gap-1.5 text-sm">CSS 文件<input ref={fileInputRef} name="file" type="file" required accept=".css,text/css" className="max-w-52 text-sm" /></label>
            <button disabled={isPending} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-neutral-700">导入主题</button>
          </form>
        </div>

        <div className="mt-7 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <h3 className="text-sm font-semibold">已安装主题</h3>
          <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-900">
            {themes.map((theme) => (
              <li key={theme} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div><span className="font-mono">{theme}</span>{theme === activeTheme && <span className="ml-2 text-xs text-neutral-500">当前使用</span>}</div>
                <div className="flex items-center gap-4"><a href={`/api/admin/themes/${encodeURIComponent(theme)}`} className="text-blue-600">导出</a>{theme !== 'default' && <button type="button" disabled={isPending || theme === activeTheme} onClick={() => deleteTheme(theme)} className="text-red-600 disabled:cursor-not-allowed disabled:opacity-40">删除</button>}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="font-semibold">站点信息</h2>
        <div className="mt-5 grid gap-5">{['siteName', 'siteDescription', 'siteUrl'].map((key) => { const setting = settings.find((item) => item.key === key); return <form key={key} action={(formData) => save(key, String(formData.get('value') ?? ''))} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]"><label className="text-sm font-medium sm:pt-2.5">{key}</label><input name="value" defaultValue={setting ? stringifyValue(setting.value) : ''} className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" /><button disabled={isPending} className="text-sm text-blue-600">保存</button></form> })}</div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="font-semibold">文章详情</h2>
        <p className="mt-1 text-sm text-neutral-500">控制文章详情页展示的元数据信息。</p>
        <div className="mt-5 grid gap-4">
          <form action={(formData) => save('articleCommentsMode', String(formData.get('commentsMode') ?? 'enabled'))} className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <label htmlFor="article-comments-mode" className="text-sm font-medium">评论</label>
                <p className="mt-1 text-sm text-neutral-500">可保留历史评论但暂停新评论，或完全从前台和公开接口隐藏评论；后台评论管理始终保留全部数据。</p>
              </div>
              <button disabled={isPending} className="text-sm text-blue-600">保存</button>
            </div>
            <select id="article-comments-mode" name="commentsMode" defaultValue={commentsMode} className="mt-4 h-10 w-full max-w-sm rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900">
              <option value="enabled">允许评论</option>
              <option value="readOnly">仅展示历史评论，关闭新评论</option>
              <option value="disabled">完全关闭评论</option>
            </select>
          </form>
          <MetadataToggle settingKey="articleMetaShowPublishedAt" fieldName="showPublishedAt" label="显示发布时间" checked={showPublishedAt} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="articleMetaShowViewCount" fieldName="showViewCount" label="显示阅读次数" checked={showViewCount} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="articleMetaShowReadingTime" fieldName="showReadingTime" label="显示预估阅读时间" checked={showReadingTime} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="articleMetaShowWordCount" fieldName="showWordCount" label="显示文章字数" checked={showWordCount} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="articleMetaShowCategory" fieldName="showCategory" label="显示分类" checked={showCategory} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="articleMetaShowTags" fieldName="showTags" label="显示标签" checked={showTags} isPending={isPending} onSave={save} />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="font-semibold">其他设置</h2>
        <div className="mt-5 space-y-4">{settings.filter((setting) => !['activeTheme', 'siteName', 'siteDescription', 'siteUrl', 'articleCommentsMode', 'articleMetaShowPublishedAt', 'articleMetaShowViewCount', 'articleMetaShowReadingTime', 'articleMetaShowWordCount', 'articleMetaShowCategory', 'articleMetaShowTags'].includes(setting.key)).map((setting) => <form key={setting.id} action={(formData) => save(setting.key, String(formData.get('value') ?? ''))} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]"><label className="font-mono text-sm sm:pt-2.5">{setting.key}</label><textarea name="value" defaultValue={stringifyValue(setting.value)} rows={2} className="rounded-md border border-neutral-300 bg-white p-3 font-mono text-xs outline-none dark:border-neutral-700 dark:bg-neutral-900" /><button disabled={isPending} className="text-sm text-blue-600">保存</button></form>)}</div>
      </section>

      {message && <p className="text-sm text-neutral-500" role="status">{message}</p>}
    </div>
  )
}

function MetadataToggle({
  settingKey,
  fieldName,
  label,
  checked,
  isPending,
  onSave,
}: {
  settingKey: string
  fieldName: string
  label: string
  checked: boolean
  isPending: boolean
  onSave: (key: string, rawValue: string) => void
}) {
  return (
    <form action={(formData) => onSave(settingKey, formData.get(fieldName) === 'on' ? 'true' : 'false')} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <label className="inline-flex items-center gap-2 text-sm font-medium">
        <input name={fieldName} type="checkbox" defaultChecked={checked} />
        {label}
      </label>
      <button disabled={isPending} className="text-sm text-blue-600">保存</button>
    </form>
  )
}
