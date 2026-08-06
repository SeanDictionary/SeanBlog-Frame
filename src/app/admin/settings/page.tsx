import { SettingsManager } from '@/components/admin/settings-manager'
import { listSettings } from '@/lib/services/setting-service'

export default async function AdminSettingsPage() {
  const settings = await listSettings()

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8"><p className="mb-2 text-sm text-neutral-500">系统管理</p><h1 className="text-3xl font-semibold tracking-tight">设置</h1></header>
      <SettingsManager initialSettings={settings} />
    </div>
  )
}
