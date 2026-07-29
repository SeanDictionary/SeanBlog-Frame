import { TaxonomyManager } from '@/components/admin/taxonomy-manager'
import { listCategories } from '@/lib/services/category-service'

export default async function AdminCategoriesPage() {
  const categories = await listCategories()

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8"><p className="mb-2 text-sm text-neutral-500">内容管理</p><h1 className="text-3xl font-semibold tracking-tight">分类</h1></header>
      <TaxonomyManager type="categories" initialItems={categories} />
    </div>
  )
}
