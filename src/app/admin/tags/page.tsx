import { TaxonomyManager } from '@/components/admin/taxonomy-manager'
import { listTags } from '@/lib/services/tag-service'

export default async function AdminTagsPage() {
  const tags = await listTags()

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <p className="mb-2 text-sm text-neutral-500">分类标签</p>
        <h1 className="text-3xl font-semibold tracking-tight">标签管理</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">维护文章标签。标签用于横向标记主题，可在文章编辑页中多选或快速新增。</p>
      </header>
      <TaxonomyManager type="tags" initialItems={tags} />
    </div>
  )
}
