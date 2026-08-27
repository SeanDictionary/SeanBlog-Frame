import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { ArticleContent } from '@/components/article/article-content'
import { ArticleMeta } from '@/components/article/article-meta'
import { ArticleNavigation } from '@/components/article/article-navigation'
import { ArticleToc } from '@/components/article/article-toc'
import { CommentList } from '@/components/comment/comment-list'
import { fromPrismaArticleCommentsMode } from '@/lib/comment-settings'
import { countContentWordsFromHtml, estimateReadingMinutesFromHtml } from '@/lib/content/reading-time'
import { isDatabaseError } from '@/lib/database-errors'
import { getPublicArticleBySlug, getPublicArticleNavigation } from '@/lib/services/article-service'
import { getMergedSettings } from '@/lib/services/theme-settings-service'
import { normalizeThemeName, readThemeTemplate } from '@/lib/theme'
import { resolveThemePage } from '@/lib/theme/resolver'
import { getThemeComponents } from '@/lib/theme/components'
import { orderThemeSlots } from '@/lib/theme-slots'

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
    const title = article.metaTitle ?? article.title
    const description = article.metaDescription ?? article.excerpt ?? undefined

    return {
      title,
      description,
      keywords: article.metaKeywords?.split(',').map((keyword) => keyword.trim()).filter(Boolean),
      openGraph: {
        type: 'article',
        title,
        description,
        publishedTime: article.publishedAt?.toISOString(),
        tags: article.tags.map((tag) => tag.name),
        images: article.coverImage ? [{ url: article.coverImage }] : undefined,
      },
    }
  } catch (error) {
    if (isDatabaseError(error)) throw error
    return {}
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params

  try {
    const [article, settings, navigation] = await Promise.all([
      getPublicArticleBySlug(slug),
      getMergedSettings(),
      getPublicArticleNavigation(slug),
    ])
    const template = await readThemeTemplate(normalizeThemeName(settings.activeTheme), 'articleDetail')
    const { contentHtml, headings } = getHeadings(article.contentHtml)
    const commentsMode = fromPrismaArticleCommentsMode(article.commentsMode)
    const readingMinutes = estimateReadingMinutesFromHtml(contentHtml)
    const wordCount = countContentWordsFromHtml(contentHtml)
    const slotContent: Record<string, ReactNode> = {
      'article-header': (
        <header className="mb-10 border-b border-border pb-9">
          <div className="mb-5 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">文章</div>
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-[-0.045em] sm:text-5xl">{article.title}</h1>
          <div className="mt-6">
            <ArticleMeta
              publishedAt={article.publishedAt}
              category={article.category}
              tags={article.tags}
              viewCount={article.viewCount}
              readingMinutes={readingMinutes}
              wordCount={wordCount}
            />
          </div>
          {article.coverImage && (
            <img src={article.coverImage} alt="" className="mt-8 aspect-video w-full rounded-(--radius) border border-border object-cover" />
          )}
        </header>
      ),
      'article-content': <ArticleContent html={contentHtml} />,
      'article-navigation': <ArticleNavigation previous={navigation.previous} next={navigation.next} />,
      comments: <CommentList articleId={article.id} comments={article.comments} mode={commentsMode} />,
      toc: <ArticleToc headings={headings} />,
    }
    const slots = orderThemeSlots(['article-header', 'article-content', 'article-navigation', 'comments', 'toc'], template?.slots)

    const themePage = await resolveThemePage(normalizeThemeName(settings.activeTheme), 'article-detail')
    if (themePage) {
      const themePageData = {
        article,
        contentHtml,
        toc: headings,
        readingMinutes,
        wordCount,
        commentsMode,
        navigation,
        comments: article.comments,
        settings,
        components: getThemeComponents(),
      } as any
      const ThemePageComponent = themePage
      return <ThemePageComponent data={themePageData} />
    }

    return (
      <div className="mx-auto max-w-6xl px-(--content-padding) py-12 sm:py-18">
        <div className="relative">
          <article className="mx-auto w-full max-w-(--content-max-width) min-w-0">
            {slots.filter((slot) => slot !== 'toc').map((slot) => <div key={slot}>{slotContent[slot]}</div>)}
          </article>
          {slots.includes('toc') && slotContent.toc}
        </div>
      </div>
    )
  } catch (error) {
    if (isDatabaseError(error)) throw error
    notFound()
  }
}
