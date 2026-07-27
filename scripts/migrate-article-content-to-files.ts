import { readFile } from 'node:fs/promises'

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { getArticleContentPath, getArticleRevisionContentPath, writeArticleMarkdownAtPath } from '../src/lib/content/article-content'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured.')
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

async function hasFile(contentPath: string) {
  try {
    await readFile(contentPath, 'utf8')
    return true
  } catch {
    return false
  }
}

async function migrateArticles() {
  const articles = await prisma.article.findMany({
    where: {
      contentPath: null,
    },
    select: {
      id: true,
      legacyContentMarkdown: true,
    },
  })

  for (const article of articles) {
    if (!article.legacyContentMarkdown) {
      throw new Error(`Article ${article.id} has no legacy Markdown content.`)
    }

    const contentPath = getArticleContentPath(article.id)

    if (!(await hasFile(contentPath))) {
      await writeArticleMarkdownAtPath(contentPath, article.legacyContentMarkdown)
    }

    await prisma.article.update({
      where: { id: article.id },
      data: { contentPath },
    })
  }

  return articles.length
}

async function migrateRevisions() {
  const revisions = await prisma.articleRevision.findMany({
    where: {
      contentPath: null,
    },
    select: {
      id: true,
      articleId: true,
      legacyContentMarkdown: true,
    },
  })

  for (const revision of revisions) {
    if (!revision.legacyContentMarkdown) {
      throw new Error(`Article revision ${revision.id} has no legacy Markdown content.`)
    }

    const contentPath = getArticleRevisionContentPath(revision.articleId, revision.id)

    if (!(await hasFile(contentPath))) {
      await writeArticleMarkdownAtPath(contentPath, revision.legacyContentMarkdown)
    }

    await prisma.articleRevision.update({
      where: { id: revision.id },
      data: { contentPath },
    })
  }

  return revisions.length
}

async function main() {
  const [articleCount, revisionCount] = await Promise.all([migrateArticles(), migrateRevisions()])
  console.log(`Migrated ${articleCount} article file(s) and ${revisionCount} revision file(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
