import { MediaManager } from '@/components/admin/media-manager'
import { MediaStorageSettings } from '@/components/admin/media-storage-settings'
import { listMedia } from '@/lib/services/media-service'
import { listSettings } from '@/lib/services/setting-service'

export default async function AdminMediaPage() {
  const [result, settings] = await Promise.all([listMedia({ page: 1, pageSize: 100 }), listSettings()])

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8"><p className="mb-2 text-sm text-neutral-500">资源管理</p><h1 className="text-3xl font-semibold tracking-tight">媒体</h1></header>
      <div className="space-y-7">
        <MediaStorageSettings initialSettings={settings} />
        <MediaManager initialMedia={result.items} />
      </div>
    </div>
  )
}
