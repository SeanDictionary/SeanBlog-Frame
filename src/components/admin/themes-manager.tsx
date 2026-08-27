'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { CalloutCssEditor } from '@/components/admin/callout-css-editor'
import { useAdminToast } from '@/components/admin/admin-toast-provider'
import { DEFAULT_CALLOUT_CSS } from '@/lib/content/callout-css'
import type { ThemeSettingSchemaItem, ThemePackageSummary } from '@/lib/theme'

type Setting = {
  id: string
  key: string
  value: unknown
}

type ThemesManagerProps = {
  initialSettings: Setting[]
  availableThemes: ThemePackageSummary[]
  calloutPreset: string
  activeThemeSlug: string
  themeSettings: Record<string, unknown>
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

function getActiveThemeSlug(settings: Setting[]) {
  const value = settingValue(settings, 'activeTheme', 'seanblog-default')
  return value === 'default' ? 'seanblog-default' : value
}

function themeSettingValue(settings: Record<string, unknown>, item: ThemeSettingSchemaItem) {
  const value = settings[item.key]
  return value ?? item.default ?? ''
}

export function ThemesManager({ initialSettings, availableThemes, calloutPreset, activeThemeSlug, themeSettings }: ThemesManagerProps) {
  const router = useRouter()
  const toast = useAdminToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [settings, setSettings] = useState(initialSettings)
  const [themes, setThemes] = useState(availableThemes)
  const [themeSettingsState, setThemeSettingsState] = useState<Record<string, unknown>>(themeSettings)
  const [isPending, startTransition] = useTransition()
  const activeTheme = getActiveThemeSlug(settings)
  const activeThemePackage = themes.find((theme) => theme.slug === activeTheme) ?? themes[0]

  function applySetting(setting: Setting) {
    setSettings((previous) => previous.some((item) => item.key === setting.key)
      ? previous.map((item) => item.key === setting.key ? setting : item)
      : [...previous, setting])
  }

  function saveSetting(key: string, value: unknown) {
    startTransition(async () => {
      

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
        
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '保存失败。')
      }
    })
  }


  function saveCalloutCss(css: string) {
    if (!activeThemePackage) return
    startTransition(async () => {
      
      try {
        const response = await fetch(`/api/admin/themes/${activeThemePackage.slug}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: { calloutCustomCss: css } }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error?.message ?? 'Callout CSS 保存失败。')
        setThemeSettingsState((prev) => ({ ...prev, calloutCustomCss: css }))
        
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Callout CSS 保存失败。')
      }
    })
  }


  function saveThemeSettings(formData: FormData) {
    if (!activeThemePackage) return

    startTransition(async () => {
      
      try {
        const newSettings: Record<string, unknown> = {}
        for (const item of Object.values(activeThemePackage.settingsSchema).flat()) {
          if (item.type === 'boolean') {
            newSettings[item.key] = formData.get(item.key) === 'on'
          } else if (item.type === 'multiselect') {
            // 从 formData 收集选中的 multiselect 选项
            const selected: string[] = []
            for (const option of item.options ?? []) {
              if (formData.get(`${item.key}__${option.value}`) === 'on') {
                selected.push(option.value)
              }
            }
            newSettings[item.key] = selected
          } else {
            newSettings[item.key] = String(formData.get(item.key) ?? item.default ?? '')
          }
        }
        // calloutCustomCss 也一起保存
        const calloutVal = themeSettingsState.calloutCustomCss
        if (typeof calloutVal === 'string' && calloutVal.trim()) {
          newSettings.calloutCustomCss = calloutVal
        }

        const response = await fetch(`/api/admin/themes/${activeThemePackage.slug}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: newSettings }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error?.message ?? '主题设置保存失败。')

        setThemeSettingsState(newSettings)
        
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '主题设置保存失败。')
      }
    })
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const response = await fetch('/api/admin/themes', { method: 'POST', body: formData })
        const data = (await response.json()) as ApiResponse

        if (!response.ok || !data.theme) {
          throw new Error(data.error?.message ?? '主题包导入失败。')
        }

        const refreshed = await fetch('/api/admin/themes')
        const refreshedData = (await refreshed.json()) as { themes?: ThemePackageSummary[] }
        if (refreshedData.themes) setThemes(refreshedData.themes)
        toast.success(`已导入主题包 ${data.theme}。`)
        if (fileInputRef.current) fileInputRef.current.value = ''
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '主题包导入失败。')
      }
    })
  }

  function deleteTheme(theme: ThemePackageSummary) {
    if (!window.confirm(`确认删除主题包 ${theme.name} 吗？`)) return

    startTransition(async () => {
      
      try {
        const response = await fetch(`/api/admin/themes/${encodeURIComponent(theme.slug)}`, { method: 'DELETE' })
        const data = response.status === 204 ? null : (await response.json()) as ApiResponse
        if (!response.ok) throw new Error(data?.error?.message ?? '主题包删除失败。')
        setThemes((previous) => previous.filter((item) => item.slug !== theme.slug))
        toast.success(`已删除主题包 ${theme.name}。`)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '主题包删除失败。')
      }
    })
  }

  return (
    <div className="space-y-7">
      <Card padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">主题包库</h2><p className="mt-1 text-sm text-neutral-500">导入、预览、启用、导出和卸载第三方主题包。主题必须包含 theme.json、模板、部件和资源目录。</p></div>
          <button type="button" disabled={isPending} onClick={() => fileInputRef.current?.click()} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"><i className="fa-solid fa-upload mr-2 text-xs" />导入主题包</button>
          <input ref={fileInputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={handleImportFile} />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {themes.map((theme) => (
            <article key={theme.slug} className={`rounded-lg border p-4 ${theme.slug === activeTheme ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-neutral-200 dark:border-neutral-800'}`}>
              <div className="h-2 rounded-t bg-linear-to-r from-accent via-accent-hover to-accent-subtle" />
              <div className="mt-4 flex items-start justify-between gap-3">
                <div><h3 className="text-base font-semibold">{theme.name}</h3><p className="mt-1 text-xs text-neutral-500">{theme.author ?? '未知作者'}</p><p className="mt-1 text-xs text-neutral-500">v{theme.version}</p></div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex flex-wrap justify-end gap-2 text-xs">
                    <a href={`/theme-preview?theme=${encodeURIComponent(theme.slug)}&page=home`} target="_blank" rel="noreferrer" className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700">主页预览</a>
                    <a href={`/theme-preview?theme=${encodeURIComponent(theme.slug)}&page=article`} target="_blank" rel="noreferrer" className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700">文章预览</a>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 text-xs">
                    <button type="button" disabled={isPending || theme.slug === activeTheme} onClick={() => saveSetting('activeTheme', theme.slug)} className="rounded bg-neutral-950 px-2 py-1 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-950">启用</button>
                    {theme.slug !== 'seanblog-default' &&
                    <>
                      <a href={`/api/admin/themes/${encodeURIComponent(theme.slug)}`} className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700">导出</a>
                      <button type="button" disabled={isPending || theme.slug === activeTheme} onClick={() => deleteTheme(theme)} className="rounded border border-red-200 px-2 py-1 text-red-600 disabled:opacity-50 dark:border-red-900/60">卸载</button>
                    </>}
                  </div>
                </div>
              </div>
              {theme.description && <p className="mt-3 text-xs leading-5 text-neutral-500">{theme.description}</p>}
            </article>
          ))}
        </div>
      </Card>

      {activeThemePackage && (
        <Card padding="lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">{activeThemePackage.name} 设置</h2>
              <p className="mt-1 text-sm text-neutral-500">主题变量和提示框样式，随主题切换。</p>
            </div>
            {Object.keys(activeThemePackage.settingsSchema).length > 0 && (
              <button type="submit" form="theme-settings-form" disabled={isPending} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">{isPending ? '保存中…' : '保存主题设置'}</button>
            )}
          </div>
          {Object.keys(activeThemePackage.settingsSchema).length > 0 && (
            <form id="theme-settings-form" action={saveThemeSettings} className="mt-5">
              {Object.entries(activeThemePackage.settingsSchema).map(([groupName, items]) => (
                <div key={groupName} className="mb-8">
                  <h3 className="mb-4 border-b border-neutral-200 pb-2 text-base font-semibold text-neutral-900 dark:border-neutral-800 dark:text-neutral-100">{groupName}</h3>
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {items.map((item) => <SettingRow key={item.key} item={item} value={themeSettingValue(themeSettingsState, item)} />)}
                  </div>
                </div>
              ))}
            </form>
          )}
          {Object.keys(activeThemePackage.settingsSchema).length > 0 && <hr className="my-6 border-neutral-200 dark:border-neutral-800" />}
          <CalloutCssEditor
            initialValue={(() => {
              const v = themeSettingsState.calloutCustomCss
              const s = typeof v === 'string' ? v : ''
              return s.trim() ? s : (calloutPreset || DEFAULT_CALLOUT_CSS)
            })()}
            presetValue={calloutPreset || DEFAULT_CALLOUT_CSS}
            onSave={saveCalloutCss}
            onReset={() => saveCalloutCss(calloutPreset || DEFAULT_CALLOUT_CSS)}
          />
        </Card>
      )}


    </div>
  )
}

function SettingRow({ item, value }: { item: ThemeSettingSchemaItem; value: unknown }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-6">
      <div className="sm:w-48 sm:shrink-0">
        <label className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{item.label}</label>
        {item.description && (
          <p className="mt-1 text-xs leading-5 text-neutral-500">{item.description}</p>
        )}
      </div>
      <div className="flex-1">
        <SettingControl item={item} value={value} />
      </div>
    </div>
  )
}

function SettingControl({ item, value }: { item: ThemeSettingSchemaItem; value: unknown }) {
  if (item.type === 'boolean') return <ToggleSwitch name={item.key} checked={value === true} />
  if (item.type === 'color') return <ColorPicker name={item.key} value={String(value)} />
  if (item.type === 'multiselect') return <MultiselectField item={item} value={value} />
  if (item.type === 'list') return <ListField item={item} value={value} />
  if (item.type === 'select') {
    if (item.options && item.options.length <= 4) {
      return <RadioGroup name={item.key} options={item.options} value={String(value)} />
    }
    return <SelectDropdown name={item.key} options={item.options ?? []} value={String(value)} />
  }
  return (
    <input name={item.key} type={item.type === 'number' ? 'number' : 'text'} defaultValue={String(value)} className="h-10 w-full max-w-sm rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
  )
}

function ToggleSwitch({ name, checked }: { name: string; checked: boolean }) {
  const [isChecked, setIsChecked] = useState(checked)
  return (
    <label className="inline-flex cursor-pointer items-center" onClick={(e) => { e.preventDefault(); setIsChecked(!isChecked) }}>
      <input name={name} type="checkbox" checked={isChecked} onChange={() => {}} className="sr-only" />
      <span className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-all duration-200 ${isChecked ? 'bg-blue-600 dark:bg-blue-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${isChecked ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </label>
  )
}

function RadioGroup({ name, options, value }: { name: string; options: Array<{ label: string; value: string }>; value: string }) {
  const [selected, setSelected] = useState(value)
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-neutral-200 p-1 dark:border-neutral-800">
      {options.map((option) => (
        <label key={option.value} className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${option.value === selected ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'}`} onClick={(e) => { e.preventDefault(); setSelected(option.value) }}>
          <input type="radio" name={name} value={option.value} checked={option.value === selected} onChange={() => {}} className="sr-only" />
          {option.label}
        </label>
      ))}
    </div>
  )
}

function SelectDropdown({ name, options, value }: { name: string; options: Array<{ label: string; value: string }>; value: string }) {
  return (
    <select name={name} defaultValue={value} className="h-10 max-w-sm rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}

function ColorPicker({ name, value }: { name: string; value: string }) {
  const presets = ['#cf829e', '#ff7a7a', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#6b7280', '#0f172a']
  const [color, setColor] = useState(value)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input name={name} type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 cursor-pointer rounded-md border border-neutral-300 dark:border-neutral-700" />
        <input type="text" value={color} readOnly className="h-10 w-24 rounded-md border border-neutral-300 bg-white px-3 text-sm font-mono dark:border-neutral-700 dark:bg-neutral-900" />
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((c) => (
          <button key={c} type="button" className={`h-7 w-7 rounded-full border-2 transition-all duration-200 hover:scale-110 ${color === c ? 'border-blue-500' : 'border-transparent'}`} style={{ backgroundColor: c }} onClick={() => setColor(c)} />
        ))}
      </div>
    </div>
  )
}

function MultiselectField({ item, value }: { item: ThemeSettingSchemaItem; value: unknown }) {
  const initialSelected = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
  const [selected, setSelected] = useState<string[]>(initialSelected)
  return (
    <div className="flex flex-wrap gap-2">
      {item.options?.map((option) => {
        const isSelected = selected.includes(option.value)
        return (
          <label key={option.value} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${isSelected ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-300' : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800'}`} onClick={(e) => { e.preventDefault(); setSelected(prev => prev.includes(option.value) ? prev.filter(v => v !== option.value) : [...prev, option.value]) }}>
            <input type="checkbox" name={`${item.key}__${option.value}`} checked={isSelected} onChange={() => {}} className="sr-only" />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}

function ListField({ item, value }: { item: ThemeSettingSchemaItem; value: unknown }) {
  const fields = item.itemFields ?? []
  const [entries, setEntries] = useState<Array<Record<string, string>>>(
    Array.isArray(value)
      ? value.filter((v): v is Record<string, string> => typeof v === 'object' && v !== null)
          .map((v) => {
            const e: Record<string, string> = {}
            for (const f of fields) e[f.key] = typeof (v as any)[f.key] === 'string' ? (v as any)[f.key] : ''
            return e
          })
      : []
  )

  function addRow() {
    const blank: Record<string, string> = {}
    for (const f of fields) blank[f.key] = ''
    setEntries((prev) => [...prev, blank])
  }

  function removeRow(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
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
          <button type="button" onClick={() => removeRow(index)} className="h-9 rounded-md border border-red-200 px-2 text-xs text-red-600 dark:border-red-900/60">删除</button>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button type="button" onClick={addRow} className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">+ 添加一行</button>
        <span className="text-xs text-neutral-400">共 {entries.length} 条</span>
      </div>
    </div>
  )
}
