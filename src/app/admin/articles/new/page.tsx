import { ArticleEditor } from '@/components/admin/article-editor'
import { listCategories } from '@/lib/services/category-service'
import { listTags } from '@/lib/services/tag-service'

export default async function NewArticlePage() {
  const [categories, tags] = await Promise.all([listCategories(), listTags()])

  return <ArticleEditor categories={categories} tags={tags} />
}
