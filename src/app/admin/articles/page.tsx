import Link from 'next/link'

import { ArticleManagementTable } from '@/components/admin/article-management-table'
import { listAdminArticles } from '@/lib/services/article-service'
import { articleListQuerySchema } from '@/lib/validations/cms'

type AdminArticlesSearchParams = {
  status?: string
  category?: string
  tag?: string
  q?: string
  sort?: string
  order?: string
  saved?: string
  bulk?: string
  imported?: string
}

function getNotice(searchParams: AdminArticlesSearchParams) {
  if (searchParams.saved === '1') return '文章已保存。'
  if (searchParams.bulk) return `已批量处理 ${searchParams.bulk} 篇文章。`
  if (searchParams.imported) return `已导入 ${searchParams.imported} 篇文章。`
  return null
}

function serializeArticle(article: Awaited<ReturnType<typeof listAdminArticles>>['items'][number]) {
  const normalizedTags = article.tags.map((item) => ('tag' in item ? item.tag : item))

  return {
    ...article,
    tags: normalizedTags,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    expiresAt: article.expiresAt?.toISOString() ?? null,
    updatedAt: article.updatedAt.toISOString(),
  }
}

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<AdminArticlesSearchParams>
}) {
  const rawSearchParams = await searchParams
  const query = articleListQuerySchema.parse(rawSearchParams)
  const result = await listAdminArticles(query)
  const notice = getNotice(rawSearchParams)
  const filters = {
    status: query.status ?? '',
    category: query.category ?? '',
    tag: query.tag ?? '',
    q: query.q ?? '',
    sort: query.sort,
    order: query.order,
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-neutral-500">内容管理</p>
          <h1 className="text-3xl font-semibold tracking-tight">文章</h1>
        </div>
        <Link href="/admin/articles/new" className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950">
          <i className="fa-solid fa-plus mr-2 text-xs" aria-hidden="true" />
          新建文章
        </Link>
      </header>

      <ArticleManagementTable
        articles={result.items.map(serializeArticle)}
        total={result.meta.total}
        filters={filters}
        initialNotice={notice}
      />
    </div>
  )
}
