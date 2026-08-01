import Link from 'next/link'

type ArticleNavigationItem = {
  title: string
  slug: string
}

type ArticleNavigationProps = {
  previous: ArticleNavigationItem | null
  next: ArticleNavigationItem | null
}

function NavigationLink({ label, article, align }: { label: string; article: ArticleNavigationItem; align: 'left' | 'right' }) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      className={`group block rounded-lg border border-border p-4 transition-colors hover:border-accent hover:bg-bg-secondary ${align === 'right' ? 'text-right' : ''}`}
    >
      <span className="font-mono text-xs uppercase tracking-[0.16em] text-text-tertiary transition-colors group-hover:text-accent">{label}</span>
      <span className="mt-2 block font-medium leading-6 text-text transition-colors group-hover:text-accent">{article.title}</span>
    </Link>
  )
}

export function ArticleNavigation({ previous, next }: ArticleNavigationProps) {
  if (!previous && !next) {
    return null
  }

  return (
    <nav className="mt-12 grid gap-4 border-t border-border pt-8 sm:grid-cols-2" aria-label="上一篇和下一篇文章">
      <div>
        {previous ? <NavigationLink label="上一篇" article={previous} align="left" /> : <span className="block rounded-lg border border-border p-4 text-sm text-text-tertiary">没有上一篇文章</span>}
      </div>
      <div>
        {next ? <NavigationLink label="下一篇" article={next} align="right" /> : <span className="block rounded-lg border border-border p-4 text-right text-sm text-text-tertiary">没有下一篇文章</span>}
      </div>
    </nav>
  )
}
