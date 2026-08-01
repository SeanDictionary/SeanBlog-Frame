import Link from 'next/link'

type ArticleNavigationItem = {
  title: string
  slug: string
}

type ArticleNavigationProps = {
  previous: ArticleNavigationItem | null
  next: ArticleNavigationItem | null
}

function NavigationLink({ label, article, align, className = '' }: { label: string; article: ArticleNavigationItem; align: 'left' | 'right'; className?: string }) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      className={`group block rounded-lg border border-border p-4 transition-colors hover:border-accent hover:bg-bg-secondary ${align === 'right' ? 'text-right' : ''} ${className}`}
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
      {previous && <NavigationLink label="上一篇" article={previous} align="left" />}
      {next && <NavigationLink label="下一篇" article={next} align="right" className={previous ? undefined : 'sm:col-start-2'} />}
    </nav>
  )
}
