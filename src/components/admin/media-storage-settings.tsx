'use client'

import { useState, useTransition } from 'react'

type Setting = {
  id: string
  key: string
  value: unknown
}

type MediaStorageSettingsProps = {
  initialSettings: Setting[]
}

type ApiResponse = {
  error?: { message?: string }
  setting?: Setting
}

type StorageDraft = {
  mediaObjectStorageEndpoint: string
  mediaObjectStorageBucket: string
  mediaObjectStorageRegion: string
  mediaObjectStoragePublicUrl: string
  mediaObjectStorageAccessKeyId: string
  mediaObjectStorageSecretAccessKey: string
}

const storageFieldLabels: Array<{ key: keyof StorageDraft; label: string; placeholder?: string; type?: string }> = [
  { key: 'mediaObjectStorageEndpoint', label: 'Endpoint', placeholder: 'https://s3.example.com' },
  { key: 'mediaObjectStorageBucket', label: 'Bucket' },
  { key: 'mediaObjectStorageRegion', label: 'Region', placeholder: 'auto / us-east-1' },
  { key: 'mediaObjectStoragePublicUrl', label: '公开访问域名', placeholder: 'https://cdn.example.com' },
  { key: 'mediaObjectStorageAccessKeyId', label: 'Access Key ID' },
  { key: 'mediaObjectStorageSecretAccessKey', label: 'Secret Access Key', type: 'password' },
]

function settingValue(settings: Setting[], key: string, fallback = '') {
  const value = settings.find((setting) => setting.key === key)?.value
  return typeof value === 'string' ? value : fallback
}

function settingEnabled(settings: Setting[], key: string, fallback = false) {
  const value = settings.find((setting) => setting.key === key)?.value
  return typeof value === 'boolean' ? value : fallback
}

function buildDraft(settings: Setting[]): StorageDraft {
  return Object.fromEntries(storageFieldLabels.map((field) => [field.key, settingValue(settings, field.key)])) as StorageDraft
}

export function MediaStorageSettings({ initialSettings }: MediaStorageSettingsProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [enabled, setEnabled] = useState(() => settingEnabled(initialSettings, 'mediaObjectStorageEnabled'))
  const [draft, setDraft] = useState(() => buildDraft(initialSettings))
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateDraft(key: keyof StorageDraft, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }))
  }

  function save() {
    const entries: Array<[string, string | boolean]> = [
      ['mediaObjectStorageEnabled', enabled],
      ...storageFieldLabels.map((field) => [field.key, draft[field.key]] as [string, string]),
    ]

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

          if (!response.ok || !data.setting) {
            throw new Error(data.error?.message ?? '对象存储设置保存失败。')
          }

          setSettings((previous) => previous.some((setting) => setting.key === key)
            ? previous.map((setting) => setting.key === key ? data.setting! : setting)
            : [...previous, data.setting!])
        }

        setMessage(enabled ? '对象存储配置已保存。开启后可供后续存储适配器读取。' : '对象存储已关闭，原配置已保留。')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '对象存储设置保存失败。')
      }
    })
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">对象存储配置</h2>
          <p className="mt-1 text-sm text-neutral-500">默认不启用；关闭时隐藏连接配置并保留已填写信息。</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs ${enabled ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'}`}>
          {enabled ? '已启用' : '默认关闭'}
        </span>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          启用对象存储配置
        </label>

        {enabled && (
          <div className="grid gap-4 md:grid-cols-2">
            {storageFieldLabels.map((field) => (
              <label key={field.key} className="grid gap-1.5 text-sm">
                {field.label}
                <input
                  value={draft[field.key]}
                  onChange={(event) => updateDraft(field.key, event.target.value)}
                  type={field.type ?? 'text'}
                  placeholder={field.placeholder}
                  className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
            ))}
          </div>
        )}

        <div>
          <button type="button" disabled={isPending} onClick={save} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">保存对象存储设置</button>
        </div>
      </div>

      {message && <p className="mt-4 text-sm text-neutral-500" role="status">{message}</p>}
    </section>
  )
}
