'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Setting = {
  id: string
  key: string
  value: unknown
}

type PersonalizationManagerProps = {
  initialSettings: Setting[]
  availableThemes: string[]
}

type ApiResponse = {
  error?: { message?: string }
  setting?: Setting
  theme?: string
}

function settingValue(settings: Setting[], key: string, fallback = '') {
  const value = settings.find((setting) => setting.key === key)?.value
  return typeof value === 'string' ? value : fallback
}

function settingEnabled(settings: Setting[], key: string, fallback = true) {
  const value = settings.find((setting) => setting.key === key)?.value
  return typeof value === 'boolean' ? value : fallback
}

export function PersonalizationManager({ initialSettings, availableThemes }: PersonalizationManagerProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [settings, setSettings] = useState(initialSettings)
  const [themes, setThemes] = useState(availableThemes)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const activeTheme = settingValue(settings, 'activeTheme', 'default')

  function saveSetting(key: string, value: unknown) {
    startTransition(async () => {
      setMessage(null)

      try {
        const response = await fetch(`/api/admin/settings/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        })
        const data = (await response.json()) as ApiResponse

        if (!response.ok || !data.setting) {
          throw new Error(data.error?.message ?? '保存失败。')
        }

        setSettings((previous) => previous.some((setting) => setting.key === key)
          ? previous.map((setting) => setting.key === key ? data.setting! : setting)
          : [...previous, data.setting!])
        setMessage('个性化设置已保存。')
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '保存失败。')
      }
    })
  }

  function saveForm(formData: FormData) {
    const entries = [
      ['publicHeaderTitle', String(formData.get('publicHeaderTitle') ?? '')],
      ['publicHeaderShowHome', formData.get('publicHeaderShowHome') === 'on'],
      ['publicHeaderShowCategories', formData.get('publicHeaderShowCategories') === 'on'],
      ['publicHeaderShowTags', formData.get('publicHeaderShowTags') === 'on'],
      ['publicHeaderShowSearch', formData.get('publicHeaderShowSearch') === 'on'],
      ['publicFooterText', String(formData.get('publicFooterText') ?? '')],
      ['publicFooterShowRss', formData.get('publicFooterShowRss') === 'on'],
      ['adminSidebarTitle', String(formData.get('adminSidebarTitle') ?? '')],
      ['adminSidebarShowViewSite', formData.get('adminSidebarShowViewSite') === 'on'],
      ['themeAccentColor', String(formData.get('themeAccentColor') ?? '')],
      ['themeContentMaxWidth', String(formData.get('themeContentMaxWidth') ?? '')],
      ['themeRadius', String(formData.get('themeRadius') ?? '')],
      ['themeHeaderHeight', String(formData.get('themeHeaderHeight') ?? '')],
    ] as const

    startTransition(async () => {
      setMessage(null)
      try {
        for (const [key, value] of entries) {
          const response = await fetch(`/api/admin/settings/${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
          })
          const data = (await response.json()) as ApiResponse
          if (!response.ok || !data.setting) throw new Error(data.error?.message ?? '保存失败。')
          setSettings((previous) => previous.some((setting) => setting.key === key)
            ? previous.map((setting) => setting.key === key ? data.setting! : setting)
            : [...previous, data.setting!])
        }
        setMessage('个性化设置已保存。')
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '保存失败。')
      }
    })
  }

  function importTheme(formData: FormData) {
    startTransition(async () => {
      setMessage(null)

      try {
        const response = await fetch('/api/admin/themes', { method: 'POST', body: formData })
        const data = (await response.json()) as ApiResponse

        if (!response.ok || !data.theme) {
          throw new Error(data.error?.message ?? '主题导入失败。')
        }

        setThemes((previous) => [...new Set([...previous, data.theme!])].sort((left, right) => left.localeCompare(right)))
        setMessage(`已导入主题 ${data.theme}。`)
        fileInputRef.current?.form?.reset()
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '主题导入失败。')
      }
    })
  }

  function deleteTheme(theme: string) {
    if (!window.confirm(`确认删除主题 ${theme} 吗？`)) return

    startTransition(async () => {
      setMessage(null)
      try {
        const response = await fetch(`/api/admin/themes/${encodeURIComponent(theme)}`, { method: 'DELETE' })
        const data = response.status === 204 ? null : (await response.json()) as ApiResponse
        if (!response.ok) throw new Error(data?.error?.message ?? '主题删除失败。')
        setThemes((previous) => previous.filter((item) => item !== theme))
        setMessage(`已删除主题 ${theme}。`)
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '主题删除失败。')
      }
    })
  }

  return (
    <div className="space-y-7">
      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">主题库</h2><p className="mt-1 text-sm text-neutral-500">以卡片方式应用、预览、导入和导出主题。</p></div>
          <form action={importTheme} className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5 text-sm">主题名<input name="name" required pattern="[a-z0-9][a-z0-9_-]{0,63}" maxLength={64} className="h-10 w-40 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
            <label className="grid gap-1.5 text-sm">CSS 文件<input ref={fileInputRef} name="file" type="file" required accept=".css,text/css" className="max-w-52 text-sm" /></label>
            <button disabled={isPending} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-neutral-700">导入主题</button>
          </form>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {themes.map((theme) => (
            <article key={theme} className={`rounded-lg border p-4 ${theme === activeTheme ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-neutral-200 dark:border-neutral-800'}`}>
              <div className="h-28 rounded-md border border-neutral-200 bg-gradient-to-br from-bg via-bg-secondary to-accent-subtle dark:border-neutral-800" />
              <div className="mt-4 flex items-start justify-between gap-3">
                <div><h3 className="font-mono text-sm font-semibold">{theme}</h3>{theme === activeTheme && <p className="mt-1 text-xs text-blue-600">当前主题</p>}</div>
                <div className="flex flex-wrap justify-end gap-2 text-xs">
                  <a href={`/admin/personalization/preview?theme=${encodeURIComponent(theme)}`} target="_blank" rel="noreferrer" className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700">预览</a>
                  <button type="button" disabled={isPending || theme === activeTheme} onClick={() => saveSetting('activeTheme', theme)} className="rounded bg-neutral-950 px-2 py-1 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-950">应用</button>
                  <a href={`/api/admin/themes/${encodeURIComponent(theme)}`} className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700">导出</a>
                  {theme !== 'default' && <button type="button" disabled={isPending || theme === activeTheme} onClick={() => deleteTheme(theme)} className="rounded border border-red-200 px-2 py-1 text-red-600 disabled:opacity-50 dark:border-red-900/60">删除</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <form action={saveForm} className="grid gap-7 xl:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="font-semibold">Header / Dock</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm">站点标题<input name="publicHeaderTitle" defaultValue={settingValue(settings, 'publicHeaderTitle')} placeholder="默认使用 siteName" className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label>
            <Toggle name="publicHeaderShowHome" label="显示首页入口" checked={settingEnabled(settings, 'publicHeaderShowHome')} />
            <Toggle name="publicHeaderShowCategories" label="显示分类入口" checked={settingEnabled(settings, 'publicHeaderShowCategories')} />
            <Toggle name="publicHeaderShowTags" label="显示标签入口" checked={settingEnabled(settings, 'publicHeaderShowTags')} />
            <Toggle name="publicHeaderShowSearch" label="显示搜索按钮" checked={settingEnabled(settings, 'publicHeaderShowSearch')} />
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="font-semibold">页脚与后台侧边栏</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm">页脚文案<input name="publicFooterText" defaultValue={settingValue(settings, 'publicFooterText')} placeholder="默认版权文案" className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label>
            <Toggle name="publicFooterShowRss" label="显示 RSS 入口" checked={settingEnabled(settings, 'publicFooterShowRss')} />
            <label className="grid gap-1.5 text-sm">后台侧边栏标题<input name="adminSidebarTitle" defaultValue={settingValue(settings, 'adminSidebarTitle', 'SeanBlog Admin')} className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label>
            <Toggle name="adminSidebarShowViewSite" label="显示“查看网站”入口" checked={settingEnabled(settings, 'adminSidebarShowViewSite')} />
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950 xl:col-span-2">
          <h2 className="font-semibold">当前主题设置</h2>
          <p className="mt-1 text-sm text-neutral-500">这些设置以 CSS 变量覆盖方式应用在当前主题之上。</p>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <label className="grid gap-1.5 text-sm">强调色<input name="themeAccentColor" type="color" defaultValue={settingValue(settings, 'themeAccentColor', '#2563eb')} className="h-10 rounded-md border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-900" /></label>
            <label className="grid gap-1.5 text-sm">内容宽度<input name="themeContentMaxWidth" defaultValue={settingValue(settings, 'themeContentMaxWidth', '48rem')} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono dark:border-neutral-700 dark:bg-neutral-900" /></label>
            <label className="grid gap-1.5 text-sm">圆角<input name="themeRadius" defaultValue={settingValue(settings, 'themeRadius', '0.375rem')} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono dark:border-neutral-700 dark:bg-neutral-900" /></label>
            <label className="grid gap-1.5 text-sm">Header 高度<input name="themeHeaderHeight" defaultValue={settingValue(settings, 'themeHeaderHeight', '4rem')} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono dark:border-neutral-700 dark:bg-neutral-900" /></label>
          </div>
          <button disabled={isPending} className="mt-5 rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">保存个性化设置</button>
        </section>
      </form>

      {message && <p className="text-sm text-neutral-500" role="status">{message}</p>}
    </div>
  )
}

function Toggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return <label className="inline-flex items-center gap-2 text-sm"><input name={name} type="checkbox" defaultChecked={checked} /> {label}</label>
}
