import { MediaManager } from '@/components/admin/media-manager'
import { listMedia } from '@/lib/services/media-service'

export default async function AdminMediaPage() {
  const result = await listMedia({ page: 1, pageSize: 100 })

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8"><p className="mb-2 text-sm text-neutral-500">资源管理</p><h1 className="text-3xl font-semibold tracking-tight">媒体</h1></header>
      <MediaManager initialMedia={result.items} />
    </div>
  )
}
