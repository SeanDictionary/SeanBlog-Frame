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
    <aside className="pointer-events-none fixed right-[max(1.5rem,calc((100vw-var(--content-max-width))/2-15rem))] top-28 z-30 hidden w-52 xl:block">
      <nav className="pointer-events-auto max-h-[calc(100vh-8rem)] overflow-y-auto border-l border-border bg-bg/80 pl-4 backdrop-blur-sm" aria-label="文章目录">
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
