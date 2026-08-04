import { ArticleStatus } from '@prisma/client'
import type { Route } from 'next'
import Link from 'next/link'

import { ArticleManagementTable } from '@/components/admin/article-management-table'
import { listAdminArticles } from '@/lib/services/article-service'
import { listCategories } from '@/lib/services/category-service'
import { listTags } from '@/lib/services/tag-service'
import { articleListQuerySchema } from '@/lib/validations/cms'

const articleStatusLabels = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  ARCHIVED: '已归档',
} satisfies Record<ArticleStatus, string>

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

function getSelectedStatus(status: string | undefined) {
  return status && status in articleStatusLabels ? status as ArticleStatus : undefined
}

function getNotice(searchParams: AdminArticlesSearchParams) {
  if (searchParams.saved === '1') return '文章已保存。'
  if (searchParams.bulk) return `已批量处理 ${searchParams.bulk} 篇文章。`
  if (searchParams.imported) return `已导入 ${searchParams.imported} 篇文章。`
  return null
}

function buildExportHref(filters: {
  status?: string
  category?: string
  tag?: string
  q?: string
  sort: string
  order: string
}) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }

  return `/api/admin/articles/export?${params.toString()}`
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
  const status = getSelectedStatus(rawSearchParams.status)
  const [result, categories, tags] = await Promise.all([
    listAdminArticles(query),
    listCategories(),
    listTags(),
  ])
  const notice = getNotice(rawSearchParams)
  const filters = {
    status: status ?? '',
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

      {notice && (
        <p className="mb-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300" role="status">
          {notice}
        </p>
      )}

      <nav className="mb-5 flex flex-wrap items-center gap-2" aria-label="文章状态筛选">
        <FilterLink href="/admin/articles" active={!status}>全部</FilterLink>
        {(Object.entries(articleStatusLabels) as Array<[ArticleStatus, string]>).map(([value, label]) => (
          <FilterLink key={value} href={`/admin/articles?status=${value}`} active={status === value}>{label}</FilterLink>
        ))}
      </nav>

      <ArticleManagementTable
        articles={result.items.map(serializeArticle)}
        categories={categories.map((category) => ({ id: category.id, name: category.name, slug: category.slug }))}
        tags={tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug }))}
        total={result.meta.total}
        filters={filters}
        exportHref={buildExportHref(filters)}
      />
    </div>
  )
}

function FilterLink({ href, active, children }: { href: Route; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950'
          : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
      }`}
    >
      {children}
    </Link>
  )
}
