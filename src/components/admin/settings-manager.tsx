'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type Setting = {
  id: string
  key: string
  value: unknown
}

type SettingsManagerProps = {
  initialSettings: Setting[]
}

type ApiResponse = {
  error?: { message?: string }
}

function stringifyValue(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

export function SettingsManager({ initialSettings }: SettingsManagerProps) {
  const router = useRouter()
  const [settings, setSettings] = useState(initialSettings)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const showPublishedAt = settings.find((setting) => setting.key === 'articleMetaShowPublishedAt')?.value !== false
  const showViewCount = settings.find((setting) => setting.key === 'articleMetaShowViewCount')?.value !== false
  const showReadingTime = settings.find((setting) => setting.key === 'articleMetaShowReadingTime')?.value !== false
  const showWordCount = settings.find((setting) => setting.key === 'articleMetaShowWordCount')?.value !== false
  const showCategory = settings.find((setting) => setting.key === 'articleMetaShowCategory')?.value !== false
  const showTags = settings.find((setting) => setting.key === 'articleMetaShowTags')?.value !== false
  const analyticsEnabled = settings.find((setting) => setting.key === 'analyticsEnabled')?.value !== false
  const analyticsCollectIp = settings.find((setting) => setting.key === 'analyticsCollectIp')?.value === true
  const analyticsCollectUserAgent = settings.find((setting) => setting.key === 'analyticsCollectUserAgent')?.value === true
  const analyticsCollectReferrer = settings.find((setting) => setting.key === 'analyticsCollectReferrer')?.value === true
  const analyticsCollectFingerprint = settings.find((setting) => setting.key === 'analyticsCollectFingerprint')?.value === true
  const analyticsCollectHardware = settings.find((setting) => setting.key === 'analyticsCollectHardware')?.value === true

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

  return (
    <div className="space-y-7">
      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="font-semibold">站点信息</h2>
        <p className="mt-1 text-sm text-neutral-500">主题包、Header、页脚和组件外观请到“个性化”页面管理。</p>
        <div className="mt-5 grid gap-5">{['siteName', 'siteDescription', 'siteUrl'].map((key) => { const setting = settings.find((item) => item.key === key); return <form key={key} action={(formData) => save(key, String(formData.get('value') ?? ''))} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]"><label className="text-sm font-medium sm:pt-2.5">{key}</label><input name="value" defaultValue={setting ? stringifyValue(setting.value) : ''} className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" /><button disabled={isPending} className="text-sm text-blue-600">保存</button></form> })}</div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="font-semibold">文章详情</h2>
        <p className="mt-1 text-sm text-neutral-500">控制文章详情页展示的元数据信息。</p>
        <div className="mt-5 grid gap-4">
          <MetadataToggle settingKey="articleMetaShowPublishedAt" fieldName="showPublishedAt" label="显示发布时间" checked={showPublishedAt} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="articleMetaShowViewCount" fieldName="showViewCount" label="显示阅读次数" checked={showViewCount} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="articleMetaShowReadingTime" fieldName="showReadingTime" label="显示预估阅读时间" checked={showReadingTime} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="articleMetaShowWordCount" fieldName="showWordCount" label="显示文章字数" checked={showWordCount} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="articleMetaShowCategory" fieldName="showCategory" label="显示分类" checked={showCategory} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="articleMetaShowTags" fieldName="showTags" label="显示标签" checked={showTags} isPending={isPending} onSave={save} />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="font-semibold">访问统计与隐私</h2>
        <p className="mt-1 text-sm text-neutral-500">默认只采集匿名访问事件和匿名访客标识。IP、UA、浏览器指纹、硬件信息、来源 URL 默认不收集，需单独开启。</p>
        <div className="mt-5 grid gap-4">
          <MetadataToggle settingKey="analyticsEnabled" fieldName="analyticsEnabled" label="启用访问统计" checked={analyticsEnabled} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="analyticsCollectIp" fieldName="analyticsCollectIp" label="采集 IP 地址" checked={analyticsCollectIp} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="analyticsCollectUserAgent" fieldName="analyticsCollectUserAgent" label="采集 User-Agent" checked={analyticsCollectUserAgent} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="analyticsCollectReferrer" fieldName="analyticsCollectReferrer" label="采集来源 URL" checked={analyticsCollectReferrer} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="analyticsCollectFingerprint" fieldName="analyticsCollectFingerprint" label="采集浏览器指纹摘要" checked={analyticsCollectFingerprint} isPending={isPending} onSave={save} />
          <MetadataToggle settingKey="analyticsCollectHardware" fieldName="analyticsCollectHardware" label="采集硬件信息摘要" checked={analyticsCollectHardware} isPending={isPending} onSave={save} />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="font-semibold">其他设置</h2>
        <div className="mt-5 space-y-4">{settings.filter((setting) => !['activeTheme', 'siteName', 'siteDescription', 'siteUrl', 'articleCommentsMode', 'commentModerationRules', 'articleMetaShowPublishedAt', 'articleMetaShowViewCount', 'articleMetaShowReadingTime', 'articleMetaShowWordCount', 'articleMetaShowCategory', 'articleMetaShowTags', 'analyticsEnabled', 'analyticsCollectIp', 'analyticsCollectUserAgent', 'analyticsCollectReferrer', 'analyticsCollectFingerprint', 'analyticsCollectHardware'].includes(setting.key) && !setting.key.startsWith('themeSetting:') && !setting.key.startsWith('publicHeader') && !setting.key.startsWith('publicFooter') && !setting.key.startsWith('adminSidebar')).map((setting) => <form key={setting.id} action={(formData) => save(setting.key, String(formData.get('value') ?? ''))} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]"><label className="font-mono text-sm sm:pt-2.5">{setting.key}</label><textarea name="value" defaultValue={stringifyValue(setting.value)} rows={2} className="rounded-md border border-neutral-300 bg-white p-3 font-mono text-xs outline-none dark:border-neutral-700 dark:bg-neutral-900" /><button disabled={isPending} className="text-sm text-blue-600">保存</button></form>)}</div>
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
