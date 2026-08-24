'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { ARTICLE_META_ITEM_IDS, type ArticleMetaItemId } from '@/components/article/article-meta'

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

type MetadataLayoutItem = {
  id: ArticleMetaItemId
  visible: boolean
}

type ArticleMetaConfig = {
  id: ArticleMetaItemId
  settingKey: string
  label: string
  detail: string
}

type AnalyticsConfig = {
  key: string
  label: string
  detail: string
  defaultValue: boolean
}

const ARTICLE_META_CONFIGS: ArticleMetaConfig[] = [
  { id: 'publishedAt', settingKey: 'articleMetaShowPublishedAt', label: '发布时间', detail: '文章发布时间。' },
  { id: 'viewCount', settingKey: 'articleMetaShowViewCount', label: '阅读次数', detail: '文章累计浏览量。' },
  { id: 'readingTime', settingKey: 'articleMetaShowReadingTime', label: '预估阅读时间', detail: '根据正文自动估算阅读分钟数。' },
  { id: 'wordCount', settingKey: 'articleMetaShowWordCount', label: '文章字数', detail: '根据正文自动统计字数。' },
  { id: 'category', settingKey: 'articleMetaShowCategory', label: '分类', detail: '文章所属分类链接。' },
  { id: 'tags', settingKey: 'articleMetaShowTags', label: '标签', detail: '文章关联标签链接。' },
]

const ANALYTICS_CONFIGS: AnalyticsConfig[] = [
  { key: 'analyticsEnabled', label: '启用访问统计', detail: '记录匿名访问事件和匿名访客标识。', defaultValue: true },
  { key: 'analyticsCollectIp', label: '采集 IP 地址', detail: '默认关闭，开启后写入访问事件。', defaultValue: false },
  { key: 'analyticsCollectUserAgent', label: '采集 User-Agent', detail: '默认关闭，开启后可分析浏览器和系统。', defaultValue: false },
  { key: 'analyticsCollectReferrer', label: '采集来源 URL', detail: '默认关闭，开启后记录 referrer。', defaultValue: false },
  { key: 'analyticsCollectFingerprint', label: '采集浏览器指纹摘要', detail: '默认关闭，仅保存摘要字段。', defaultValue: false },
  { key: 'analyticsCollectHardware', label: '采集硬件信息摘要', detail: '默认关闭，仅保存摘要字段。', defaultValue: false },
]

const ANALYTICS_RETENTION_SETTING_KEY = 'analyticsRetentionDays'
const DEFAULT_ANALYTICS_RETENTION_DAYS = 180
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
  'articleMetaOrder',
  ...ARTICLE_META_CONFIGS.map((item) => item.settingKey),
  ANALYTICS_RETENTION_SETTING_KEY,
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

function normalizeArticleMetaOrder(value: unknown) {
  const orderedIds = Array.isArray(value)
    ? value.filter((item): item is ArticleMetaItemId => typeof item === 'string' && ARTICLE_META_ITEM_IDS.includes(item as ArticleMetaItemId))
    : []
  const orderedSet = new Set(orderedIds)

  return [...orderedIds, ...ARTICLE_META_ITEM_IDS.filter((item) => !orderedSet.has(item))]
}

function buildMetadataLayout(settings: Setting[]): MetadataLayoutItem[] {
  return normalizeArticleMetaOrder(getSettingValue(settings, 'articleMetaOrder')).map((id) => {
    const config = ARTICLE_META_CONFIGS.find((item) => item.id === id)

    return {
      id,
      visible: config ? getBooleanSetting(settings, config.settingKey, true) : true,
    }
  })
}

function buildAnalyticsSettings(settings: Setting[]) {
  return Object.fromEntries(ANALYTICS_CONFIGS.map((item) => [item.key, getBooleanSetting(settings, item.key, item.defaultValue)])) as Record<string, boolean>
}

function buildAnalyticsRetentionDays(settings: Setting[]) {
  const value = getSettingValue(settings, ANALYTICS_RETENTION_SETTING_KEY)
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.min(3650, Math.max(1, Math.round(number))) : DEFAULT_ANALYTICS_RETENTION_DAYS
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
  const [metadataLayout, setMetadataLayout] = useState(() => buildMetadataLayout(initialSettings))
  const [draggedMetaId, setDraggedMetaId] = useState<ArticleMetaItemId | null>(null)
  const [analyticsSettings, setAnalyticsSettings] = useState(() => buildAnalyticsSettings(initialSettings))
  const [analyticsRetentionDays, setAnalyticsRetentionDays] = useState(() => buildAnalyticsRetentionDays(initialSettings))
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

  async function persistSettings(scope: 'analytics' | 'article-meta' | 'public-layout' | 'theme-settings' | 'object-storage' | 'site-info', updates: SettingUpdate[]) {
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
        const setting = await persistSetting(key, value)
        setSettings((previous) => mergeSettings(previous, [setting]))
        setMessage(`已保存 ${key}。`)
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
        setMessage(successMessage)
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
        setMessage('已保存访问统计设置。')
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
        setMessage('已保存站点信息。')
        router.refresh()
      } catch (error) {
        reportError(error, '站点信息保存失败。')
      }
    })
  }

  function moveMetadataItem(id: ArticleMetaItemId, targetVisible: boolean, targetId?: ArticleMetaItemId, placement: 'before' | 'after' = 'after') {
    const visibleIds = metadataLayout.filter((item) => item.visible && item.id !== id).map((item) => item.id)
    const hiddenIds = metadataLayout.filter((item) => !item.visible && item.id !== id).map((item) => item.id)
    const targetIds = targetVisible ? visibleIds : hiddenIds
    const targetIndex = targetId ? targetIds.indexOf(targetId) : -1
    const insertIndex = targetIndex === -1 ? targetIds.length : targetIndex + (placement === 'after' ? 1 : 0)

    targetIds.splice(insertIndex, 0, id)

    setMetadataLayout([
      ...visibleIds.map((itemId) => ({ id: itemId, visible: true })),
      ...hiddenIds.map((itemId) => ({ id: itemId, visible: false })),
    ])
  }

  function saveMetadataLayout() {
    const visibleIds = metadataLayout.filter((item) => item.visible).map((item) => item.id)
    const updates = ARTICLE_META_CONFIGS.map((config) => ({
      key: config.settingKey,
      value: visibleIds.includes(config.id),
    }))

    startTransition(async () => {
      setMessage(null)

      try {
        const savedSettings = await persistSettings('article-meta', [...updates, { key: 'articleMetaOrder', value: visibleIds }])
        setSettings((previous) => mergeSettings(previous, savedSettings))
        setMessage('已保存文章元数据设置。')
        router.refresh()
      } catch (error) {
        reportError(error, '文章元数据设置保存失败。')
      }
    })
  }

  function renderMetadataZone(visible: boolean) {
    const items = metadataLayout.filter((item) => item.visible === visible)

    return (
      <div
        className="flex items-center gap-3 overflow-hidden rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-4 dark:border-neutral-700 dark:bg-neutral-900/40"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          if (draggedMetaId) moveMetadataItem(draggedMetaId, visible)
          setDraggedMetaId(null)
        }}
      >
        <div className="flex h-[38px] shrink-0 items-center gap-2">
          <h3 className="text-sm font-semibold">{visible ? '显示' : '隐藏'}</h3>
          <span className="text-xs text-neutral-500">{items.length} 项</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto pb-1">
          {items.length > 0 ? items.map((item) => {
            const config = ARTICLE_META_CONFIGS.find((meta) => meta.id === item.id)!

            return (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDraggedMetaId(item.id)}
                onDragEnd={() => setDraggedMetaId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (!draggedMetaId) return

                  const rect = event.currentTarget.getBoundingClientRect()
                  const placement = event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
                  moveMetadataItem(draggedMetaId, visible, item.id, placement)
                  setDraggedMetaId(null)
                }}
                className={`inline-flex shrink-0 cursor-grab items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm font-medium active:cursor-grabbing dark:border-neutral-800 dark:bg-neutral-950 ${draggedMetaId === item.id ? 'opacity-50' : ''}`}
              >
                <span>{config.label}</span>
                <i className="fa-solid fa-grip-vertical text-xs text-neutral-400" aria-hidden="true" />
              </div>
            )
          }) : <p className="min-w-36 rounded-full border border-dashed border-neutral-200 px-3 py-2 text-center text-sm text-neutral-500 dark:border-neutral-800">拖到这里</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="font-semibold">站点信息</h2>
        <p className="mt-1 text-sm text-neutral-500">主题包、Header、页脚和组件外观请到“个性化”页面管理。</p>
        <div className="mt-5 grid gap-5">
          <form action={(formData) => {
            saveSiteInfo(
              ['siteName', 'siteDescription', 'siteUrl'].map((key) => ({ key, value: String(formData.get(key) ?? '') }))
            )
          }} className="grid gap-5">
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
            <div className="flex justify-end">
              <button disabled={isPending} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-950">保存站点信息</button>
            </div>
          </form>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">文章详情</h2>
            <p className="mt-1 text-sm text-neutral-500">拖动元数据到“显示”或“不显示”，并调整显示区顺序。</p>
          </div>
          <button type="button" disabled={isPending} onClick={saveMetadataLayout} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-950">保存元数据设置</button>
        </div>
        <div className="mt-5 grid gap-4">
          {renderMetadataZone(true)}
          {renderMetadataZone(false)}
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <form action={(formData) => {
          const next = Object.fromEntries(ANALYTICS_CONFIGS.map((item) => [item.key, formData.get(item.key) === 'on'])) as Record<string, boolean>
          const nextRetentionDays = Math.min(3650, Math.max(1, Number(formData.get(ANALYTICS_RETENTION_SETTING_KEY) ?? DEFAULT_ANALYTICS_RETENTION_DAYS)))
          const nextOperationLogRetentionDays = Math.min(MAX_OPERATION_LOG_RETENTION_DAYS, Math.max(1, Number(formData.get(OPERATION_LOG_RETENTION_SETTING_KEY) ?? DEFAULT_OPERATION_LOG_RETENTION_DAYS)))
          const nextIpinfoToken = String(formData.get('ipinfoToken') ?? '').trim()
          setAnalyticsSettings(next)
          setAnalyticsRetentionDays(nextRetentionDays)
          setOperationLogRetentionDays(nextOperationLogRetentionDays)
          setIpinfoToken(nextIpinfoToken)
          saveAnalyticsSettings([
            ...ANALYTICS_CONFIGS.map((item) => ({ key: item.key, value: next[item.key] })),
            { key: ANALYTICS_RETENTION_SETTING_KEY, value: nextRetentionDays },
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
              <span className="font-medium">每日明细保留天数</span>
              <span className="text-xs text-neutral-500">默认 180 天。统计事件永久保留；后台趋势、访客导出和单卡片范围最大不超过该窗口。</span>
              <input name="analyticsRetentionDays" type="number" min="1" max="3650" value={analyticsRetentionDays} onChange={(event) => setAnalyticsRetentionDays(Number(event.target.value))} className="mt-2 h-10 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" />
            </label>
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
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="font-semibold">其他设置</h2>
        <div className="mt-5 space-y-4">{settings.filter((setting) => !EXCLUDED_SETTING_KEYS.has(setting.key) && !setting.key.startsWith('themeSetting:') && !setting.key.startsWith('publicHeader') && !setting.key.startsWith('publicFooter') && !setting.key.startsWith('adminSidebar')).map((setting) => <form key={setting.id} action={(formData) => save(setting.key, String(formData.get('value') ?? ''))} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]"><label className="font-mono text-sm sm:pt-2.5">{setting.key}</label><textarea name="value" defaultValue={stringifyValue(setting.value)} rows={2} className="rounded-md border border-neutral-300 bg-white p-3 font-mono text-xs outline-none dark:border-neutral-700 dark:bg-neutral-900" /><button disabled={isPending} className="text-sm text-blue-600">保存</button></form>)}</div>
      </section>

      {message && <p className="text-sm text-neutral-500" role="status">{message}</p>}
    </div>
  )
}
