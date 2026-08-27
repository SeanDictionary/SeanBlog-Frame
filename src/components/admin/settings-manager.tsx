'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Card } from '@/components/ui/card'

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
  setting?: Setting
  settings?: Setting[]
}

type SettingUpdate = {
  key: string
  value: unknown
}

type AnalyticsConfig = {
  key: string
  label: string
  detail: string
  defaultValue: boolean
}

const ANALYTICS_CONFIGS: AnalyticsConfig[] = [
  { key: 'analyticsEnabled', label: '启用访问统计', detail: '记录匿名访问事件和匿名访客标识。', defaultValue: true },
  { key: 'analyticsCollectIp', label: '采集 IP 地址', detail: '默认关闭，开启后写入访问事件。', defaultValue: false },
  { key: 'analyticsCollectUserAgent', label: '采集 User-Agent', detail: '默认关闭，开启后可分析浏览器和系统。', defaultValue: false },
  { key: 'analyticsCollectReferrer', label: '采集来源 URL', detail: '默认关闭，开启后记录 referrer。', defaultValue: false },
  { key: 'analyticsCollectFingerprint', label: '采集浏览器指纹摘要', detail: '默认关闭，仅保存摘要字段。', defaultValue: false },
  { key: 'analyticsCollectHardware', label: '采集硬件信息摘要', detail: '默认关闭，仅保存摘要字段。', defaultValue: false },
]

const OPERATION_LOG_RETENTION_SETTING_KEY = 'operationLogRetentionDays'
const DEFAULT_OPERATION_LOG_RETENTION_DAYS = 365
const MAX_OPERATION_LOG_RETENTION_DAYS = 3650

const EXCLUDED_SETTING_KEYS = new Set([
  'activeTheme',
  'siteName',
  'siteDescription',
  'siteUrl',
  'articleCommentsMode',
  'commentModerationRules',
  OPERATION_LOG_RETENTION_SETTING_KEY,
  ...ANALYTICS_CONFIGS.map((item) => item.key),
])

function stringifyValue(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function getSettingValue(settings: Setting[], key: string) {
  return settings.find((setting) => setting.key === key)?.value
}

function getBooleanSetting(settings: Setting[], key: string, fallback: boolean) {
  const value = getSettingValue(settings, key)
  return typeof value === 'boolean' ? value : fallback
}

function mergeSettings(previous: Setting[], nextSettings: Setting[]) {
  const nextByKey = new Map(nextSettings.map((setting) => [setting.key, setting]))
  const merged = previous.map((setting) => nextByKey.get(setting.key) ?? setting)
  const existingKeys = new Set(previous.map((setting) => setting.key))

  return [...merged, ...nextSettings.filter((setting) => !existingKeys.has(setting.key))]
}

function buildAnalyticsSettings(settings: Setting[]) {
  return Object.fromEntries(ANALYTICS_CONFIGS.map((item) => [item.key, getBooleanSetting(settings, item.key, item.defaultValue)])) as Record<string, boolean>
}


function buildOperationLogRetentionDays(settings: Setting[]) {
  const value = getSettingValue(settings, OPERATION_LOG_RETENTION_SETTING_KEY)
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.min(MAX_OPERATION_LOG_RETENTION_DAYS, Math.max(1, Math.round(number))) : DEFAULT_OPERATION_LOG_RETENTION_DAYS
}

function buildIpinfoToken(settings: Setting[]) {
  const value = getSettingValue(settings, 'ipinfoToken')
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
}

export function SettingsManager({ initialSettings }: SettingsManagerProps) {
  const router = useRouter()
  const [settings, setSettings] = useState(initialSettings)
  const [analyticsSettings, setAnalyticsSettings] = useState(() => buildAnalyticsSettings(initialSettings))
  const [operationLogRetentionDays, setOperationLogRetentionDays] = useState(() => buildOperationLogRetentionDays(initialSettings))
  const [ipinfoToken, setIpinfoToken] = useState(() => buildIpinfoToken(initialSettings))
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reportError(error: unknown, fallback: string) {
    setMessage(error instanceof Error ? error.message : fallback)
  }

  async function persistSetting(key: string, value: unknown) {
    const response = await fetch(`/api/admin/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    const data = (await response.json()) as ApiResponse

    if (!response.ok || !data.setting) {
      throw new Error(data.error?.message ?? '保存失败。')
    }

    return data.setting
  }

  async function persistSettings(scope: 'analytics' | 'public-layout' | 'theme-settings' | 'object-storage' | 'site-info', updates: SettingUpdate[]) {
    const response = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, updates }),
    })
    const data = (await response.json()) as ApiResponse

    if (!response.ok || !data.settings) {
      throw new Error(data.error?.message ?? '保存失败。')
    }

    return data.settings
  }

  function save(key: string, rawValue: string, label?: string) {
    startTransition(async () => {
      setMessage(null)
      let value: unknown = rawValue

      try {
        value = JSON.parse(rawValue)
      } catch {
        // Plain strings are valid setting values.
      }

      try {
        const setting = await persistSetting(key, value)
        setSettings((previous) => mergeSettings(previous, [setting]))
        setMessage(null)
        router.refresh()
      } catch (error) {
        reportError(error, '保存失败。')
      }
    })
  }

  function saveMany(updates: SettingUpdate[], successMessage: string) {
    startTransition(async () => {
      setMessage(null)

      try {
        const savedSettings = await Promise.all(updates.map((update) => persistSetting(update.key, update.value)))
        setSettings((previous) => mergeSettings(previous, savedSettings))
        setMessage(null)
        router.refresh()
      } catch (error) {
        reportError(error, '保存失败。')
      }
    })
  }

  function saveAnalyticsSettings(updates: SettingUpdate[]) {
    startTransition(async () => {
      setMessage(null)

      try {
        const savedSettings = await persistSettings('analytics', updates)
        setSettings((previous) => mergeSettings(previous, savedSettings))
        setMessage(null)
        router.refresh()
      } catch (error) {
        reportError(error, '访问统计设置保存失败。')
      }
    })
  }

  function saveSiteInfo(updates: SettingUpdate[]) {
    startTransition(async () => {
      setMessage(null)

      try {
        const savedSettings = await persistSettings('site-info', updates)
        setSettings((previous) => mergeSettings(previous, savedSettings))
        setMessage(null)
        router.refresh()
      } catch (error) {
        reportError(error, '站点信息保存失败。')
      }
    })
  }

  return (
    <div className="space-y-7">
      <Card padding="lg">
        <form id="site-info-form" action={(formData) => {
          saveSiteInfo(
            ['siteName', 'siteDescription', 'siteUrl'].map((key) => ({ key, value: String(formData.get(key) ?? '') }))
          )
        }} className="grid gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">站点信息</h2>
              <p className="mt-1 text-sm text-neutral-500">主题包、Header、页脚和组件外观请到“个性化”页面管理。</p>
            </div>
            <button type="submit" disabled={isPending} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-950">保存</button>
          </div>
          <div className="grid gap-5">
            {['siteName', 'siteDescription', 'siteUrl'].map((key) => {
              const setting = settings.find((item) => item.key === key)
              const isMultiline = key === 'siteDescription'

              return (
                <div key={key} className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                  <label className="text-sm font-medium sm:pt-2.5">{key}</label>
                  {isMultiline
                    ? <textarea name={key} defaultValue={setting ? stringifyValue(setting.value) : ''} rows={2} className="rounded-md border border-neutral-300 bg-white p-3 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" />
                    : <input name={key} defaultValue={setting ? stringifyValue(setting.value) : ''} className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" />}
                </div>
              )
            })}
          </div>
        </form>
      </Card>

      <Card padding="lg">
        <form action={(formData) => {
          const next = Object.fromEntries(ANALYTICS_CONFIGS.map((item) => [item.key, formData.get(item.key) === 'on'])) as Record<string, boolean>
          const nextOperationLogRetentionDays = Math.min(MAX_OPERATION_LOG_RETENTION_DAYS, Math.max(1, Number(formData.get(OPERATION_LOG_RETENTION_SETTING_KEY) ?? DEFAULT_OPERATION_LOG_RETENTION_DAYS)))
          const nextIpinfoToken = String(formData.get('ipinfoToken') ?? '').trim()
          setAnalyticsSettings(next)
          setOperationLogRetentionDays(nextOperationLogRetentionDays)
          setIpinfoToken(nextIpinfoToken)
          saveAnalyticsSettings([
            ...ANALYTICS_CONFIGS.map((item) => ({ key: item.key, value: next[item.key] })),
            { key: OPERATION_LOG_RETENTION_SETTING_KEY, value: nextOperationLogRetentionDays },
            { key: 'ipinfoToken', value: nextIpinfoToken },
          ])
        }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">访问统计与隐私</h2>
              <p className="mt-1 text-sm text-neutral-500">默认只采集匿名访问事件和匿名访客标识。IP、UA、浏览器指纹、硬件信息、来源 URL 默认不收集，需单独开启。</p>
            </div>
            <button disabled={isPending} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-950">保存统计设置</button>
          </div>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5 rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800">
              <span className="font-medium">操作日志保留天数</span>
              <span className="text-xs text-neutral-500">默认 365 天。超过该天数的操作日志会被定期清理脚本删除；运行 <code className="font-mono">npm run logs:prune</code> 手动清理。</span>
              <input name="operationLogRetentionDays" type="number" min="1" max={MAX_OPERATION_LOG_RETENTION_DAYS} value={operationLogRetentionDays} onChange={(event) => setOperationLogRetentionDays(Number(event.target.value))} className="mt-2 h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" />
            </label>
            <label className="grid gap-1.5 rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800">
              <span className="font-medium">ipinfo.io 访问令牌（可选）</span>
              <span className="text-xs text-neutral-500">地区按访问 IP 通过 https://api.ipinfo.io/lite/ 查询。留空则不调用接口，地区留空。在 https://ipinfo.io 注册免费账号获取 token。</span>
              <input name="ipinfoToken" type="password" value={ipinfoToken} onChange={(event) => setIpinfoToken(event.target.value)} autoComplete="off" className="mt-2 h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-900" />
            </label>
            {ANALYTICS_CONFIGS.map((item) => (
              <label key={item.key} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <span>
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="mt-1 block text-xs text-neutral-500">{item.detail}</span>
                </span>
                <input name={item.key} type="checkbox" checked={analyticsSettings[item.key]} onChange={(event) => setAnalyticsSettings((previous) => ({ ...previous, [item.key]: event.target.checked }))} />
              </label>
            ))}
          </div>
        </form>
      </Card>


      <Card padding="lg">
        <form action={(formData) => {
          saveMany([
            { key: 'publicFooterText', value: String(formData.get('publicFooterText') ?? '') },
            { key: 'publicFooterShowRss', value: formData.get('publicFooterShowRss') === 'on' },
          ], 'footer')
        }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">页脚</h2>
              <p className="mt-1 text-sm text-neutral-500">支持 HTML，将直接渲染到前台页脚区域。</p>
            </div>
            <button type="submit" disabled={isPending} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-950">保存</button>
          </div>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm">页脚内容（HTML）<textarea name="publicFooterText" defaultValue={stringifyValue(settings.find((s) => s.key === 'publicFooterText')?.value) ?? ''} rows={4} placeholder='<p>© 2024 SeanBlog. All rights reserved.</p>' className="rounded-md border border-neutral-300 bg-white p-3 font-mono text-xs outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
            <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="publicFooterShowRss" type="checkbox" defaultChecked={getBooleanSetting(settings, 'publicFooterShowRss', true)} /> 显示 RSS 入口</label>
          </div>
        </form>
      </Card>

      {message && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{message}</p>}
    </div>
  )
}
