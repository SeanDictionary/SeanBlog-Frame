type ArticleTocProps = {
  headings: Array<{
    id: string
    text: string
    level: number
  }>
}

export function ArticleToc({ headings }: ArticleTocProps) {
  if (headings.length === 0) {
    return null
  }

  return (
    <aside className="hidden xl:block">
      <nav className="sticky top-24 border-l border-border pl-4" aria-label="文章目录">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-text-tertiary">本页目录</p>
        <ol className="space-y-2 text-sm">
          {headings.map((heading) => (
            <li key={heading.id} style={{ paddingLeft: `${Math.max(0, heading.level - 2) * 0.75}rem` }}>
              <a href={`#${heading.id}`} className="block leading-5 text-text-secondary transition-colors hover:text-accent">
                {heading.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </aside>
  )
}
