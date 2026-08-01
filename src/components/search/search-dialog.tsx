'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

type SearchResult = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: { id: string; name: string; slug: string } | null
}

type SearchResponse = {
  items: SearchResult[]
}

export function SearchDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const close = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsOpen(false)
    setQuery('')
    setResults([])
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsOpen(true)
      }

      if (event.key === 'Escape') {
        close()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    const normalizedQuery = query.trim()

    if (!isOpen || normalizedQuery.length === 0) {
      abortControllerRef.current?.abort()
      setResults([])
      return
    }

    const timeout = window.setTimeout(() => {
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      startTransition(async () => {
        try {
          const response = await fetch(`/api/search?q=${encodeURIComponent(normalizedQuery)}&page=1&pageSize=6`, {
            signal: controller.signal,
          })

          if (!response.ok) {
            throw new Error('Search request failed.')
          }

          const data = (await response.json()) as SearchResponse
          setResults(data.items)
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            setResults([])
          }
        }
      })
    }, 180)

    return () => window.clearTimeout(timeout)
  }, [isOpen, query])

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text"
        aria-label="搜索文章"
      >
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
        <span className="hidden sm:inline">搜索</span>
        <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[0.625rem] text-text-tertiary sm:inline">⌘K</kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/40 px-4 pt-[12vh] backdrop-blur-[2px] sm:pt-[18vh]" role="presentation" onMouseDown={close}>
      <section
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-bg shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="搜索文章"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center border-b border-border px-5">
          <i className="fa-solid fa-magnifying-glass text-sm text-text-tertiary" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入关键词搜索文章…"
            className="h-15 min-w-0 flex-1 bg-transparent px-4 text-base outline-none placeholder:text-text-tertiary"
          />
          <button type="button" onClick={close} className="text-xs text-text-tertiary transition-colors hover:text-text">
            ESC
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {query.trim().length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-text-tertiary">输入关键词，或按 Esc 关闭搜索。</p>
          ) : isPending ? (
            <p className="px-3 py-8 text-center text-sm text-text-tertiary">正在搜索…</p>
          ) : results.length > 0 ? (
            <ul>
              {results.map((result) => (
                <li key={result.id}>
                  <Link href={`/articles/${result.slug}`} onClick={close} className="block rounded-(--radius) px-3 py-3 transition-colors hover:bg-bg-secondary">
                    <p className="font-medium">{result.title}</p>
                    {result.excerpt && <p className="mt-1 line-clamp-2 text-sm leading-6 text-text-secondary">{result.excerpt}</p>}
                    {result.category && <p className="mt-2 text-xs text-text-tertiary">{result.category.name}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-8 text-center text-sm text-text-tertiary">没有找到相关文章。</p>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-text-tertiary">
          <span>输入时实时搜索</span>
          <Link href={query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search'} onClick={close} className="transition-colors hover:text-accent">
            查看完整搜索结果 <i className="fa-solid fa-arrow-right ml-1" aria-hidden="true" />
          </Link>
        </footer>
      </section>
    </div>
  )
}
