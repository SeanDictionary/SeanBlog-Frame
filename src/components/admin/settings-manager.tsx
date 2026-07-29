'use client'

import { useState, useTransition } from 'react'

type Setting = {
  id: string
  key: string
  value: unknown
}

type SettingsManagerProps = {
  initialSettings: Setting[]
  availableThemes: string[]
}

function stringifyValue(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

export function SettingsManager({ initialSettings, availableThemes }: SettingsManagerProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save(key: string, rawValue: string) {
    startTransition(async () => {
      setMessage(null)
      let value: unknown = rawValue
      try { value = JSON.parse(rawValue) } catch { /* Plain string settings are valid. */ }

      try {
        const response = await fetch(`/api/admin/settings/${encodeURIComponent(key)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value }) })
        const data = (await response.json()) as { setting?: Setting; error?: { message?: string } }
        if (!response.ok || !data.setting) throw new Error(data.error?.message ?? '保存失败。')
        setSettings((previous) => previous.some((setting) => setting.key === key) ? previous.map((setting) => setting.key === key ? data.setting! : setting) : [...previous, data.setting!])
        setMessage(`已保存 ${key}。`)
      } catch (error) { setMessage(error instanceof Error ? error.message : '保存失败。') }
    })
  }

  return <div className="space-y-7">
    <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"><h2 className="font-semibold">前台主题</h2><p className="mt-1 text-sm text-neutral-500">主题仅用于前台页面。选择的主题名称会保存为 <code>activeTheme</code> 设置；主题 CSS 文件存储在持久化 themes 目录中。</p><form action={(formData) => save('activeTheme', String(formData.get('theme') ?? 'default'))} className="mt-5 flex flex-wrap items-end gap-3"><label className="grid gap-1.5 text-sm">当前主题<select name="theme" defaultValue={String(settings.find((setting) => setting.key === 'activeTheme')?.value ?? 'default')} className="h-10 min-w-48 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900">{availableThemes.map((theme) => <option key={theme} value={theme}>{theme}</option>)}</select></label><button disabled={isPending} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">应用主题</button></form></section>
    <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"><h2 className="font-semibold">站点信息</h2><div className="mt-5 grid gap-5">{['siteName', 'siteDescription', 'siteUrl'].map((key) => { const setting = settings.find((item) => item.key === key); return <form key={key} action={(formData) => save(key, String(formData.get('value') ?? ''))} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]"><label className="text-sm font-medium sm:pt-2.5">{key}</label><input name="value" defaultValue={setting ? stringifyValue(setting.value) : ''} className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" /><button disabled={isPending} className="text-sm text-blue-600">保存</button></form> })}</div></section>
    <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"><h2 className="font-semibold">其他设置</h2><div className="mt-5 space-y-4">{settings.filter((setting) => !['activeTheme', 'siteName', 'siteDescription', 'siteUrl'].includes(setting.key)).map((setting) => <form key={setting.id} action={(formData) => save(setting.key, String(formData.get('value') ?? ''))} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]"><label className="font-mono text-sm sm:pt-2.5">{setting.key}</label><textarea name="value" defaultValue={stringifyValue(setting.value)} rows={2} className="rounded-md border border-neutral-300 bg-white p-3 font-mono text-xs outline-none dark:border-neutral-700 dark:bg-neutral-900" /><button disabled={isPending} className="text-sm text-blue-600">保存</button></form>)}</div></section>{message && <p className="text-sm text-neutral-500" role="status">{message}</p>}
  </div>
}
