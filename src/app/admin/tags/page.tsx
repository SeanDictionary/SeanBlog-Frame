import { TaxonomyManager } from '@/components/admin/taxonomy-manager'
import { listTags } from '@/lib/services/tag-service'

export default async function AdminTagsPage() {
  const tags = await listTags()

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <p className="mb-2 text-sm text-neutral-500">分类标签</p>
        <h1 className="text-3xl font-semibold tracking-tight">标签管理</h1>
      </header>
      <TaxonomyManager type="tags" initialItems={tags} />
    </div>
  )
}
