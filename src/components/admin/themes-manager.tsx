'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { CalloutCssEditor } from '@/components/admin/callout-css-editor'
import { useAdminToast } from '@/components/admin/admin-toast-provider'
import { DEFAULT_CALLOUT_CSS } from '@/lib/content/callout-css'
import type { ThemeSettingSchemaItem, SettingsSchema, ThemePackageSummary } from '@/lib/theme'
import { flattenSchemaItems } from '@/lib/theme/schema-utils'
import { computeVisibility } from '@/lib/theme/setting-condition'

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

/** 由 schema 默认值 + 已保存设置构建一份用于驱动显隐的 live 值表。 */
function buildLiveValues(schema: SettingsSchema, saved: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...saved }
  for (const item of flattenSchemaItems(schema)) {
    if (result[item.key] === undefined && item.default !== undefined) {
      result[item.key] = item.default
    }
  }
  return result
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
  // 驱动设置项按需显隐的实时值表：随控件交互更新，保存后与后端同步
  const [liveValues, setLiveValues] = useState<Record<string, unknown>>(() =>
    activeThemePackage ? buildLiveValues(activeThemePackage.settingsSchema, themeSettings) : {},
  )
  // 含级联隐藏的可见性映射：随 liveValues 变化重算
  const visibilityMap = activeThemePackage
    ? computeVisibility(activeThemePackage.settingsSchema, liveValues)
    : {}

  function updateValue(key: string, value: unknown) {
    setLiveValues((prev) => ({ ...prev, [key]: value }))
  }

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
        const vis = computeVisibility(activeThemePackage.settingsSchema, liveValues)
        for (const item of flattenSchemaItems(activeThemePackage.settingsSchema)) {
          // 隐藏项（含级联隐藏）不提交，服务端部分合并保留其原值
          if (vis[item.key] === false) continue
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
          } else if (item.type === 'list') {
            // 从 formData 收集 list 条目：${key}[i].field
            const fields = item.itemFields ?? []
            const re = new RegExp(`^${item.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\[(\\d+)\\]\\.(.+)$`)
            const buckets: Array<Record<string, string>> = []
            for (const [fname, fvalue] of formData.entries()) {
              const m = String(fname).match(re)
              if (!m) continue
              const idx = Number(m[1])
              if (!buckets[idx]) buckets[idx] = {}
              buckets[idx][m[2]] = String(fvalue)
            }
            const entries: Array<Record<string, string>> = []
            for (const b of buckets) {
              if (!b) continue
              const row: Record<string, string> = {}
              for (const f of fields) row[f.key] = b[f.key] ?? ''
              entries.push(row)
            }
            newSettings[item.key] = entries
          } else if (item.type === 'range' || item.type === 'number') {
            newSettings[item.key] = Number(formData.get(item.key) ?? item.default ?? 0)
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
        setLiveValues(buildLiveValues(activeThemePackage.settingsSchema, newSettings))
        
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
              {Object.entries(activeThemePackage.settingsSchema).map(([groupName, group]) => {
                const row = (item: ThemeSettingSchemaItem) => (
                  <SettingRow key={item.key} item={item} value={themeSettingValue(liveValues, item)} onChange={updateValue} />
                )
                const itemRowsClass = 'divide-y divide-neutral-200 border-l border-neutral-200 pl-6 dark:divide-neutral-800 dark:border-neutral-800'
                if (Array.isArray(group)) {
                  const items = group.filter((item) => visibilityMap[item.key] !== false)
                  if (!items.length) return null
                  return (
                    <div key={groupName} className="mb-8">
                      <h3 className="mb-4 border-b border-neutral-200 pb-2 text-base font-semibold text-neutral-900 dark:border-neutral-800 dark:text-neutral-100">{groupName}</h3>
                      <div className={itemRowsClass}>{items.map(row)}</div>
                    </div>
                  )
                }
                // 2 层分组：组 → 子组 → 项
                const subs = Object.entries(group)
                  .map(([subName, items]) => [subName, items.filter((item) => visibilityMap[item.key] !== false)] as const)
                  .filter(([, items]) => items.length > 0)
                if (!subs.length) return null
                return (
                  <div key={groupName} className="mb-8">
                    <h3 className="mb-4 border-b border-neutral-200 pb-2 text-base font-semibold text-neutral-900 dark:border-neutral-800 dark:text-neutral-100">{groupName}</h3>
                    <div className="space-y-6">
                      {subs.map(([subName, items]) => (
                        <div key={subName}>
                          <h4 className="mb-3 text-sm font-semibold text-neutral-600 dark:text-neutral-400">{subName}</h4>
                          <div className={itemRowsClass}>{items.map(row)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
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

function SettingRow({ item, value, onChange }: { item: ThemeSettingSchemaItem; value: unknown; onChange: (key: string, value: unknown) => void }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-6">
      <div className="sm:w-48 sm:shrink-0">
        <label className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{item.label}</label>
        {item.description && (
          <p className="mt-1 text-xs leading-5 text-neutral-500">{item.description}</p>
        )}
      </div>
      <div className="flex-1">
        <SettingControl item={item} value={value} onChange={(v) => onChange(item.key, v)} />
      </div>
    </div>
  )
}

function SettingControl({ item, value, onChange }: { item: ThemeSettingSchemaItem; value: unknown; onChange: (value: unknown) => void }) {
  if (item.type === 'boolean') return <ToggleSwitch name={item.key} checked={value === true} onChange={onChange} />
  if (item.type === 'color') return <ColorPicker name={item.key} value={String(value)} onChange={onChange} />
  if (item.type === 'multiselect') return <MultiselectField item={item} value={value} onChange={onChange} />
  if (item.type === 'list') return <ListField item={item} value={value} onChange={onChange} />
  if (item.type === 'range') return <RangeSlider item={item} value={Number(value)} onChange={onChange} />
  if (item.type === 'textarea') return <TextareaField name={item.key} value={String(value)} onChange={onChange} />
  if (item.type === 'select') {
    if (item.options && item.options.length <= 4) {
      return <RadioGroup name={item.key} options={item.options} value={String(value)} onChange={onChange} />
    }
    return <SelectDropdown name={item.key} options={item.options ?? []} value={String(value)} onChange={onChange} />
  }
  return (
    <input
      name={item.key}
      type={item.type === 'number' ? 'number' : 'text'}
      defaultValue={String(value)}
      onChange={(e) => onChange(item.type === 'number' ? Number(e.target.value) : e.target.value)}
      className="h-10 w-full max-w-sm rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
    />
  )
}

function RangeSlider({ item, value, onChange }: { item: ThemeSettingSchemaItem; value: number; onChange: (value: number) => void }) {
  const min = item.min ?? 0
  const max = item.max ?? 100
  const step = item.step ?? 1
  return (
    <div className="flex items-center gap-3">
      <input
        name={item.key}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 max-w-sm flex-1 cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-700"
      />
      <span className="w-14 shrink-0 text-right text-sm tabular-nums text-neutral-600 dark:text-neutral-400">{value}</span>
    </div>
  )
}

function TextareaField({ name, value, onChange }: { name: string; value: string; onChange: (value: string) => void }) {
  return (
    <textarea
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      className="w-full max-w-sm rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
    />
  )
}

function ToggleSwitch({ name, checked, onChange }: { name: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center" onClick={(e) => { e.preventDefault(); const next = !checked; onChange(next) }}>
      <input name={name} type="checkbox" checked={checked} onChange={() => {}} className="sr-only" />
      <span className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-all duration-200 ${checked ? 'bg-blue-600 dark:bg-blue-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </label>
  )
}

function RadioGroup({ name, options, value, onChange }: { name: string; options: Array<{ label: string; value: string }>; value: string; onChange: (value: string) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-neutral-200 p-1 dark:border-neutral-800">
      {options.map((option) => (
        <label key={option.value} className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${option.value === value ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'}`} onClick={(e) => { e.preventDefault(); onChange(option.value) }}>
          <input type="radio" name={name} value={option.value} checked={option.value === value} onChange={() => {}} className="sr-only" />
          {option.label}
        </label>
      ))}
    </div>
  )
}

function SelectDropdown({ name, options, value, onChange }: { name: string; options: Array<{ label: string; value: string }>; value: string; onChange: (value: string) => void }) {
  return (
    <select name={name} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 max-w-sm rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}

function ColorPicker({ name, value, onChange }: { name: string; value: string; onChange: (value: string) => void }) {
  const presets = ['#cf829e', '#ff7a7a', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#6b7280', '#0f172a']
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input name={name} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-16 cursor-pointer rounded-md border border-neutral-300 dark:border-neutral-700" />
        <input type="text" value={value} readOnly className="h-10 w-24 rounded-md border border-neutral-300 bg-white px-3 text-sm font-mono dark:border-neutral-700 dark:bg-neutral-900" />
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((c) => (
          <button key={c} type="button" className={`h-7 w-7 rounded-full border-2 transition-all duration-200 hover:scale-110 ${value === c ? 'border-blue-500' : 'border-transparent'}`} style={{ backgroundColor: c }} onClick={() => onChange(c)} />
        ))}
      </div>
    </div>
  )
}

function MultiselectField({ item, value, onChange }: { item: ThemeSettingSchemaItem; value: unknown; onChange: (value: string[]) => void }) {
  const selected = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
  return (
    <div className="flex flex-wrap gap-2">
      {item.options?.map((option) => {
        const isSelected = selected.includes(option.value)
        return (
          <label key={option.value} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${isSelected ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-300' : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800'}`} onClick={(e) => { e.preventDefault(); onChange(selected.includes(option.value) ? selected.filter(v => v !== option.value) : [...selected, option.value]) }}>
            <input type="checkbox" name={`${item.key}__${option.value}`} checked={isSelected} onChange={() => {}} className="sr-only" />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}

function ListField({ item, value, onChange }: { item: ThemeSettingSchemaItem; value: unknown; onChange: (value: Array<Record<string, string>>) => void }) {
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

  function commit(next: Array<Record<string, string>>) {
    setEntries(next)
    onChange(next)
  }

  function addRow() {
    const blank: Record<string, string> = {}
    for (const f of fields) blank[f.key] = ''
    commit([...entries, blank])
  }

  function removeRow(index: number) {
    commit(entries.filter((_, i) => i !== index))
  }

  function updateField(index: number, fieldKey: string, fieldValue: string) {
    const next = entries.map((entry, i) => i === index ? { ...entry, [fieldKey]: fieldValue } : entry)
    commit(next)
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
              onChange={(e) => updateField(index, field.key, e.target.value)}
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
