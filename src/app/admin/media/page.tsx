import { MediaManager } from '@/components/admin/media-manager'
import { listMedia } from '@/lib/services/media-service'
import { mediaListQuerySchema } from '@/lib/validations/cms'

type AdminMediaSearchParams = {
  page?: string
  pageSize?: string
  q?: string
}

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<AdminMediaSearchParams>
}) {
  const rawSearchParams = await searchParams
  const query = mediaListQuerySchema.parse(rawSearchParams)
  const result = await listMedia(query)

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <p className="mb-2 text-sm text-neutral-500">资源管理</p>
        <h1 className="text-3xl font-semibold tracking-tight">媒体</h1>
      </header>
      <MediaManager
        initialMedia={result.items}
        meta={result.meta}
        filters={{ q: query.q ?? '', page: query.page, pageSize: query.pageSize }}
      />
    </div>
  )
}
