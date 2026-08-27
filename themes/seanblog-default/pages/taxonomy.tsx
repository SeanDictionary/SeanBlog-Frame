import type { Route } from 'next'
import type { ReactNode } from 'react'

export default function DefaultTaxonomyPage({ data }: { data: any }) {
  const { taxonomy, articles, pagination } = data
  const { ArticleCard, Pagination } = data.components
  const basePath = taxonomy.type === 'tag' ? `/tags/${taxonomy.slug}` : `/categories/${taxonomy.slug}`
  const pageHref = (nextPage: number): Route => (nextPage === 1 ? basePath : `${basePath}?page=${nextPage}`) as Route

  const slotContent: Record<string, ReactNode> = {
    'taxonomy-header': (
      <header className="mb-10 border-b border-border pb-8">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">{taxonomy.type === 'tag' ? '标签' : '分类'} · {pagination.total} 篇文章</p>
        <h1 className="text-4xl font-semibold tracking-[-0.045em]">{taxonomy.name}</h1>
        {taxonomy.description && <p className="mt-4 max-w-2xl leading-7 text-text-secondary">{taxonomy.description}</p>}
      </header>
    ),
    'article-list': articles.length > 0 ? (
      <div>{articles.map((article: any) => <ArticleCard key={article.id} article={article as any} />)}</div>
    ) : (
      <p className="border-t border-border py-12 text-text-secondary">{taxonomy.type === 'tag' ? '这个标签还没有文章。' : '这个分类还没有文章。'}</p>
    ),
    pagination: <Pagination currentPage={pagination.page} pageCount={pagination.pageCount} hrefForPage={pageHref} />,
  }
  const slots = ['taxonomy-header', 'article-list', 'pagination']

  return (
    <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-12 sm:py-18">
      {slots.map((slot) => <div key={slot}>{slotContent[slot]}</div>)}
    </div>
  )
}
