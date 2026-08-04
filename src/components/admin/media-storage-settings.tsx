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

function settingValue(settings: Setting[], key: string, fallback = '') {
  const value = settings.find((setting) => setting.key === key)?.value
  return typeof value === 'string' ? value : fallback
}

function settingEnabled(settings: Setting[], key: string, fallback = false) {
  const value = settings.find((setting) => setting.key === key)?.value
  return typeof value === 'boolean' ? value : fallback
}

export function MediaStorageSettings({ initialSettings }: MediaStorageSettingsProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save(formData: FormData) {
    const entries = [
      ['mediaObjectStorageEnabled', formData.get('mediaObjectStorageEnabled') === 'on'],
      ['mediaObjectStorageEndpoint', String(formData.get('mediaObjectStorageEndpoint') ?? '')],
      ['mediaObjectStorageBucket', String(formData.get('mediaObjectStorageBucket') ?? '')],
      ['mediaObjectStorageRegion', String(formData.get('mediaObjectStorageRegion') ?? '')],
      ['mediaObjectStoragePublicUrl', String(formData.get('mediaObjectStoragePublicUrl') ?? '')],
      ['mediaObjectStorageAccessKeyId', String(formData.get('mediaObjectStorageAccessKeyId') ?? '')],
      ['mediaObjectStorageSecretAccessKey', String(formData.get('mediaObjectStorageSecretAccessKey') ?? '')],
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

          if (!response.ok || !data.setting) {
            throw new Error(data.error?.message ?? '对象存储设置保存失败。')
          }

          setSettings((previous) => previous.some((setting) => setting.key === key)
            ? previous.map((setting) => setting.key === key ? data.setting! : setting)
            : [...previous, data.setting!])
        }

        setMessage('对象存储配置已保存。当前默认仍使用本地上传；开启后可供后续存储适配器读取。')
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
          <p className="mt-1 text-sm text-neutral-500">默认不启用。这里先保存对象存储连接信息，便于后续把媒体上传切换到 S3/R2/OSS 等服务。</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs ${settingEnabled(settings, 'mediaObjectStorageEnabled') ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'}`}>
          {settingEnabled(settings, 'mediaObjectStorageEnabled') ? '已启用' : '默认关闭'}
        </span>
      </div>

      <form action={save} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="inline-flex items-center gap-2 text-sm font-medium md:col-span-2">
          <input name="mediaObjectStorageEnabled" type="checkbox" defaultChecked={settingEnabled(settings, 'mediaObjectStorageEnabled')} />
          启用对象存储配置
        </label>
        <label className="grid gap-1.5 text-sm">Endpoint<input name="mediaObjectStorageEndpoint" defaultValue={settingValue(settings, 'mediaObjectStorageEndpoint')} placeholder="https://s3.example.com" className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <label className="grid gap-1.5 text-sm">Bucket<input name="mediaObjectStorageBucket" defaultValue={settingValue(settings, 'mediaObjectStorageBucket')} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <label className="grid gap-1.5 text-sm">Region<input name="mediaObjectStorageRegion" defaultValue={settingValue(settings, 'mediaObjectStorageRegion')} placeholder="auto / us-east-1" className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <label className="grid gap-1.5 text-sm">公开访问域名<input name="mediaObjectStoragePublicUrl" defaultValue={settingValue(settings, 'mediaObjectStoragePublicUrl')} placeholder="https://cdn.example.com" className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <label className="grid gap-1.5 text-sm">Access Key ID<input name="mediaObjectStorageAccessKeyId" defaultValue={settingValue(settings, 'mediaObjectStorageAccessKeyId')} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <label className="grid gap-1.5 text-sm">Secret Access Key<input name="mediaObjectStorageSecretAccessKey" type="password" defaultValue={settingValue(settings, 'mediaObjectStorageSecretAccessKey')} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
        <div className="md:col-span-2">
          <button disabled={isPending} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">保存对象存储配置</button>
        </div>
      </form>

      {message && <p className="mt-4 text-sm text-neutral-500" role="status">{message}</p>}
    </section>
  )
}
