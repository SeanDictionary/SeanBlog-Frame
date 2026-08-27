'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { CalloutCssEditor } from '@/components/admin/callout-css-editor'
import { DEFAULT_CALLOUT_CSS } from '@/lib/content/callout-css'
import type { ThemeSettingSchemaItem, ThemePackageSummary } from '@/lib/theme'

type Setting = {
  id: string
  key: string
  value: unknown
}





type PersonalizationManagerProps = {
  initialSettings: Setting[]
  availableThemes: ThemePackageSummary[]
  calloutPreset: string
  activeThemeSlug: string
}

type ApiResponse = {
  error?: { message?: string }
  setting?: Setting
  settings?: Setting[]
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

function getActiveThemeSlug(settings: Setting[]) {
  const value = settingValue(settings, 'activeTheme', 'seanblog-default')
  return value === 'default' ? 'seanblog-default' : value
}

function themeSettingKey(themeSlug: string, key: string) {
  return `themeSetting:${themeSlug}:${key}`
}

function themeSettingValue(settings: Setting[], themeSlug: string, item: ThemeSettingSchemaItem) {
  const setting = settings.find((entry) => entry.key === themeSettingKey(themeSlug, item.key))?.value
  return setting ?? item.default ?? ''
}

export function PersonalizationManager({ initialSettings, availableThemes, calloutPreset, activeThemeSlug }: PersonalizationManagerProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [settings, setSettings] = useState(initialSettings)
  const [themes, setThemes] = useState(availableThemes)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const activeTheme = getActiveThemeSlug(settings)
  const activeThemePackage = themes.find((theme) => theme.slug === activeTheme) ?? themes[0]

  function applySetting(setting: Setting) {
    setSettings((previous) => previous.some((item) => item.key === setting.key)
      ? previous.map((item) => item.key === setting.key ? setting : item)
      : [...previous, setting])
  }

  function applySettings(nextSettings: Setting[]) {
    const nextByKey = new Map(nextSettings.map((setting) => [setting.key, setting]))
    setSettings((previous) => [
      ...previous.map((item) => nextByKey.get(item.key) ?? item),
      ...nextSettings.filter((setting) => !previous.some((item) => item.key === setting.key)),
    ])
  }

  async function persistSettings(scope: 'public-layout' | 'theme-settings', updates: Array<{ key: string; value: unknown }>, themeSlug?: string) {
    const response = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, ...(themeSlug ? { themeSlug } : {}), updates }),
    })
    const data = (await response.json()) as ApiResponse

    if (!response.ok || !data.settings) {
      throw new Error(data.error?.message ?? '保存失败。')
    }

    return data.settings
  }

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

        applySetting(data.setting)
        setMessage(null)
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '保存失败。')
      }
    })
  }

  function saveForm(formData: FormData) {
    const entries = [
      ['publicHeaderTitle', String(formData.get('publicHeaderTitle') ?? '')],
      ['publicFooterText', String(formData.get('publicFooterText') ?? '')],
      ['publicFooterShowRss', formData.get('publicFooterShowRss') === 'on'],
    ] as const

    startTransition(async () => {
      setMessage(null)
      try {
        const savedSettings = await persistSettings('public-layout', entries.map(([key, value]) => ({ key, value })))
        applySettings(savedSettings)
        setMessage(null)
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '保存失败。')
      }
    })
  }

  function saveThemeSettings(formData: FormData) {
    if (!activeThemePackage) return

    startTransition(async () => {
      setMessage(null)
      try {
        const updates = activeThemePackage.settingsSchema.map((item) => ({
          key: themeSettingKey(activeThemePackage.slug, item.key),
          value: item.type === 'boolean'
            ? formData.get(item.key) === 'on'
            : String(formData.get(item.key) ?? item.default ?? ''),
        }))
        const savedSettings = await persistSettings('theme-settings', updates, activeThemePackage.slug)
        applySettings(savedSettings)
        setMessage(null)
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '主题设置保存失败。')
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
          throw new Error(data.error?.message ?? '主题包导入失败。')
        }

        const refreshed = await fetch('/api/admin/themes')
        const refreshedData = (await refreshed.json()) as { themes?: ThemePackageSummary[] }
        if (refreshedData.themes) setThemes(refreshedData.themes)
        setMessage(`已导入主题包 ${data.theme}。`)
        fileInputRef.current?.form?.reset()
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '主题包导入失败。')
      }
    })
  }

  function deleteTheme(theme: ThemePackageSummary) {
    if (!window.confirm(`确认删除主题包 ${theme.name} 吗？`)) return

    startTransition(async () => {
      setMessage(null)
      try {
        const response = await fetch(`/api/admin/themes/${encodeURIComponent(theme.slug)}`, { method: 'DELETE' })
        const data = response.status === 204 ? null : (await response.json()) as ApiResponse
        if (!response.ok) throw new Error(data?.error?.message ?? '主题包删除失败。')
        setThemes((previous) => previous.filter((item) => item.slug !== theme.slug))
        setMessage(`已删除主题包 ${theme.name}。`)
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '主题包删除失败。')
      }
    })
  }

  return (
    <div className="space-y-7">
      <Card padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">主题包库</h2><p className="mt-1 text-sm text-neutral-500">导入、预览、启用、导出和卸载第三方主题包。主题必须包含 theme.json、模板、部件和资源目录。</p></div>
          <form action={importTheme} className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5 text-sm">主题包 ZIP<input ref={fileInputRef} name="file" type="file" required accept=".zip,application/zip" className="max-w-64 text-sm" /></label>
            <button disabled={isPending} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-neutral-700">导入主题包</button>
          </form>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {themes.map((theme) => (
            <article key={theme.slug} className={`rounded-lg border p-4 ${theme.slug === activeTheme ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-neutral-200 dark:border-neutral-800'}`}>
              <div className="h-2 rounded-t bg-gradient-to-r from-accent via-accent-hover to-accent-subtle" />
              <div className="mt-4 flex items-start justify-between gap-3">
                <div><h3 className="text-sm font-semibold">{theme.name}</h3><p className="mt-1 text-xs text-neutral-500">{theme.author ?? '未知作者'} · v{theme.version}</p>{theme.slug === activeTheme && <p className="mt-1 text-xs text-blue-600">当前主题包</p>}</div>
                <div className="flex flex-wrap justify-end gap-2 text-xs">
                  <a href={`/theme-preview?theme=${encodeURIComponent(theme.slug)}&page=home`} target="_blank" rel="noreferrer" className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700">主页预览</a>
                  <a href={`/theme-preview?theme=${encodeURIComponent(theme.slug)}&page=article`} target="_blank" rel="noreferrer" className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700">文章预览</a>
                  <button type="button" disabled={isPending || theme.slug === activeTheme} onClick={() => saveSetting('activeTheme', theme.slug)} className="rounded bg-neutral-950 px-2 py-1 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-950">启用</button>
                  <a href={`/api/admin/themes/${encodeURIComponent(theme.slug)}`} className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700">导出</a>
                  {theme.slug !== 'seanblog-default' && <button type="button" disabled={isPending || theme.slug === activeTheme} onClick={() => deleteTheme(theme)} className="rounded border border-red-200 px-2 py-1 text-red-600 disabled:opacity-50 dark:border-red-900/60">卸载</button>}
                </div>
              </div>
              {theme.description && <p className="mt-3 text-xs leading-5 text-neutral-500">{theme.description}</p>}
            </article>
          ))}
        </div>
      </Card>

      <form action={saveForm} className="grid gap-7">
        <Card padding="lg">
          <h2 className="font-semibold">页脚</h2>
          <p className="mt-1 text-sm text-neutral-500">Dock 栏和 Header 样式由主题包控制，请到主题设置中配置。此处仅保留页脚文案和 RSS 开关。</p>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm">页脚文案<input name="publicFooterText" defaultValue={settingValue(settings, 'publicFooterText')} placeholder="默认版权文案" className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label>
            <Toggle name="publicFooterShowRss" label="显示 RSS 入口" checked={settingEnabled(settings, 'publicFooterShowRss')} />
          </div>
        </Card>
        <div>
          <button disabled={isPending} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">保存页脚设置</button>
        </div>
      </form>

      {activeThemePackage && (
        <Card padding="lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">{activeThemePackage.name} 设置</h2>
              <p className="mt-1 text-sm text-neutral-500">主题变量和提示框样式，随主题切换。</p>
            </div>
          </div>
          {activeThemePackage.settingsSchema.length > 0 && (
            <form action={saveThemeSettings} className="mt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {activeThemePackage.settingsSchema.map((item) => <ThemeSettingField key={item.key} item={item} value={themeSettingValue(settings, activeThemePackage.slug, item)} />)}
              </div>
              <div className="mt-4">
                <button type="submit" disabled={isPending} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">保存主题变量</button>
              </div>
            </form>
          )}
          {activeThemePackage.settingsSchema.length > 0 && <hr className="my-6 border-neutral-200 dark:border-neutral-800" />}
          <CalloutCssEditor
            initialValue={(() => {
              const key = `calloutCustomCss:${activeThemeSlug}`
              const v = settings.find((s) => s.key === key)?.value
              const s = typeof v === 'string' ? v : ''
              return s.trim() ? s : (calloutPreset || DEFAULT_CALLOUT_CSS)
            })()}
            presetValue={calloutPreset || DEFAULT_CALLOUT_CSS}
            onSave={(css) => saveSetting(`calloutCustomCss:${activeThemeSlug}`, css)}
            onReset={() => saveSetting(`calloutCustomCss:${activeThemeSlug}`, calloutPreset || DEFAULT_CALLOUT_CSS)}
          />
        </Card>
      )}

      
    </div>
  )
}

function ThemeSettingField({ item, value }: { item: ThemeSettingSchemaItem; value: unknown }) {
  if (item.type === 'boolean') return <Toggle name={item.key} label={item.label} checked={value === true} />
  if (item.type === 'select') return <label className="grid gap-1.5 text-sm">{item.label}<select name={item.key} defaultValue={String(value)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900">{item.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
  if (item.type === 'multiselect') return <MultiselectField item={item} value={value} />
  if (item.type === 'list') return <ListField item={item} value={value} />
  return <label className="grid gap-1.5 text-sm">{item.label}<input name={item.key} type={item.type === 'color' ? 'color' : item.type === 'number' ? 'number' : 'text'} defaultValue={String(value)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono dark:border-neutral-700 dark:bg-neutral-900" /></label>
}

function Toggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return <label className="inline-flex items-center gap-2 text-sm"><input name={name} type="checkbox" defaultChecked={checked} /> {label}</label>
}

function MultiselectField({ item, value }: { item: ThemeSettingSchemaItem; value: unknown }) {
  const selected = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
  return (
    <div className="grid gap-1.5 text-sm">
      <span>{item.label}</span>
      <div className="flex flex-wrap gap-2">
        {item.options?.map((option) => (
          <label key={option.value} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700">
            <input type="checkbox" name={`${item.key}__${option.value}`} defaultChecked={selected.includes(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  )
}

function ListField({ item, value }: { item: ThemeSettingSchemaItem; value: unknown }) {
  const items = Array.isArray(value) ? value.filter((v): v is Record<string, string> => typeof v === 'object' && v !== null) : []
  const fields = item.itemFields ?? []
  return (
    <div className="grid gap-2 text-sm">
      <span>{item.label}</span>
      <div className="space-y-2">
        {items.map((entry, index) => (
          <div key={index} className="flex flex-wrap gap-2">
            {fields.map((field) => (
              <input
                key={field.key}
                name={`${item.key}[${index}].${field.key}`}
                type={field.type === 'number' ? 'number' : field.type === 'color' ? 'color' : 'text'}
                defaultValue={entry[field.key] ?? ''}
                placeholder={field.label}
                className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              />
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-neutral-400">共 {items.length} 条。删除请清空内容后保存。</p>
    </div>
  )
}
