import { notFound } from 'next/navigation'
import type { Route } from 'next'
import type { ReactNode } from 'react'

import { ArticleCard } from '@/components/article/article-card'
import { Pagination } from '@/components/pagination'
import { isDatabaseError } from '@/lib/database-errors'
import { getPublicCategoryBySlug } from '@/lib/services/category-service'
import { listPublicArticles } from '@/lib/services/article-service'
import { getSiteSettingsMap } from '@/lib/services/setting-service'
import { normalizeThemeName, readThemeTemplate } from '@/lib/theme'
import { resolveThemePage } from '@/lib/theme/resolver'
import { orderThemeSlots } from '@/lib/theme-slots'

type CategoryPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '1', 10)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, { page: pageParam }] = await Promise.all([params, searchParams])
  const page = parsePage(pageParam)

  try {
    const [category, result, settings] = await Promise.all([
      getPublicCategoryBySlug(slug),
      listPublicArticles({ page, pageSize: 12, category: slug }),
      getSiteSettingsMap(),
    ])
    const template = await readThemeTemplate(normalizeThemeName(settings.activeTheme), 'taxonomy')
    const pageHref = (nextPage: number): Route => (nextPage === 1 ? `/categories/${slug}` : `/categories/${slug}?page=${nextPage}`) as Route
    const slotContent: Record<string, ReactNode> = {
      'taxonomy-header': (
        <header className="mb-10 border-b border-border pb-8">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">分类 · {category._count.articles} 篇文章</p>
          <h1 className="text-4xl font-semibold tracking-[-0.045em]">{category.name}</h1>
          {category.description && <p className="mt-4 max-w-2xl leading-7 text-text-secondary">{category.description}</p>}
        </header>
      ),
      'article-list': result.items.length > 0 ? (
        <div>{result.items.map((article) => <ArticleCard key={article.id} article={article} />)}</div>
      ) : (
        <p className="border-t border-border py-12 text-text-secondary">这个分类还没有文章。</p>
      ),
      pagination: <Pagination currentPage={result.meta.page} pageCount={result.meta.pageCount} hrefForPage={pageHref} />,
    }
    const slots = orderThemeSlots(['taxonomy-header', 'article-list', 'pagination'], template?.slots)

    const themePage = await resolveThemePage(normalizeThemeName(settings.activeTheme), 'taxonomy')
    if (themePage) {
      const themePageData = {
        taxonomy: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          type: 'category',
        },
        articles: result.items,
        pagination: result.meta,
        settings,
        components: {},
      } as any
      const ThemePageComponent = themePage
      return <ThemePageComponent data={themePageData} />
    }

    return (
      <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 sm:py-18">
        {slots.map((slot) => <div key={slot}>{slotContent[slot]}</div>)}
      </div>
    )
  } catch (error) {
    if (isDatabaseError(error)) throw error
    notFound()
  }
}
