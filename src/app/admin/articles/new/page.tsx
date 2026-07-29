import Link from 'next/link'

import { ArticleEditor } from '@/components/admin/article-editor'
import { listCategories } from '@/lib/services/category-service'
import { listTags } from '@/lib/services/tag-service'

export default async function NewArticlePage() {
  const [categories, tags] = await Promise.all([listCategories(), listTags()])

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-neutral-500">内容管理</p>
          <h1 className="text-3xl font-semibold tracking-tight">新建文章</h1>
        </div>
        <Link href="/admin/articles" className="text-sm text-neutral-500 transition-colors hover:text-neutral-950 dark:hover:text-neutral-50">返回文章列表</Link>
      </header>

      <ArticleEditor categories={categories} tags={tags} />
    </div>
  )
}
