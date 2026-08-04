import { TaxonomyManager } from '@/components/admin/taxonomy-manager'
import { listCategories } from '@/lib/services/category-service'
import { listTags } from '@/lib/services/tag-service'

export default async function AdminTaxonomyPage() {
  const [categories, tags] = await Promise.all([listCategories(), listTags()])

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <p className="mb-2 text-sm text-neutral-500">内容管理</p>
        <h1 className="text-3xl font-semibold tracking-tight">分类标签</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">统一维护文章分类与标签。分类负责内容分组，标签用于横向标记主题。</p>
      </header>
      <div className="grid gap-7 xl:grid-cols-2">
        <TaxonomyManager type="categories" initialItems={categories} />
        <TaxonomyManager type="tags" initialItems={tags} />
      </div>
    </div>
  )
}
