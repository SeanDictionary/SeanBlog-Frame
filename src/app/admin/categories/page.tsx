import { TaxonomyManager } from '@/components/admin/taxonomy-manager'
import { listCategories } from '@/lib/services/category-service'

export default async function AdminCategoriesPage() {
  const categories = await listCategories()

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <p className="mb-2 text-sm text-neutral-500">分类标签</p>
        <h1 className="text-3xl font-semibold tracking-tight">分类管理</h1>
      </header>
      <TaxonomyManager type="categories" initialItems={categories} />
    </div>
  )
}
