import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ArticleContent } from '@/components/article/article-content'
import { ArticleMeta } from '@/components/article/article-meta'
import { ArticleToc } from '@/components/article/article-toc'
import { getPublicArticleBySlug } from '@/lib/services/article-service'

type ArticlePageProps = {
  params: Promise<{ slug: string }>
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function slugifyHeading(value: string) {
  return stripHtml(value)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/[\s-]+/g, '-')
}

function getHeadings(html: string) {
  const headings: Array<{ id: string; text: string; level: number }> = []
  const usedIds = new Map<string, number>()
  const headingPattern = /<h([2-4])>([\s\S]*?)<\/h\1>/g

  const contentHtml = html.replace(headingPattern, (_match, rawLevel: string, content: string) => {
    const text = stripHtml(content)
    const baseId = slugifyHeading(text) || 'section'
    const count = usedIds.get(baseId) ?? 0
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`

    usedIds.set(baseId, count + 1)
    headings.push({ id, text, level: Number(rawLevel) })

    return `<h${rawLevel} id="${id}">${content}</h${rawLevel}>`
  })

  return { contentHtml, headings }
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params

  try {
    const article = await getPublicArticleBySlug(slug)

    return {
      title: article.metaTitle ?? article.title,
      description: article.metaDescription ?? article.excerpt ?? undefined,
      keywords: article.metaKeywords?.split(',').map((keyword) => keyword.trim()).filter(Boolean),
    }
  } catch {
    return {}
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params

  try {
    const article = await getPublicArticleBySlug(slug)
    const { contentHtml, headings } = getHeadings(article.contentHtml)

    return (
      <div className="mx-auto max-w-6xl px-(--content-padding) py-12 sm:py-18">
        <div className="xl:grid xl:grid-cols-[minmax(0,48rem)_13rem] xl:justify-center xl:gap-16">
          <article className="min-w-0">
            <header className="mb-10 border-b border-border pb-9">
              <div className="mb-5 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">文章</div>
              <h1 className="text-4xl font-semibold leading-[1.15] tracking-[-0.045em] sm:text-5xl">{article.title}</h1>
              <div className="mt-6">
                <ArticleMeta
                  publishedAt={article.publishedAt}
                  category={article.category}
                  tags={article.tags}
                  viewCount={article.viewCount}
                />
              </div>
            </header>

            <ArticleContent html={contentHtml} />
          </article>

          <ArticleToc headings={headings} />
        </div>
      </div>
    )
  } catch {
    notFound()
  }
}
