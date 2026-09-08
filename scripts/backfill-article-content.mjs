/**
 * 回填现有文章的 contentHtml 和 searchText
 * 运行：npx tsx scripts/backfill-article-content.mjs
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

function buildSearchText(title, excerpt, markdown) {
  const plainText = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/#{1,6}\s/g, ' ')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/[-*+]\s/g, ' ')
    .replace(/\d+\.\s/g, ' ')
    .replace(/>\s/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return [title, excerpt, plainText].filter(Boolean).join(' ')
}

async function readMarkdown(contentPath, legacyContentMarkdown) {
  if (contentPath) {
    try {
      const absPath = path.join(process.cwd(), contentPath)
      return await readFile(absPath, 'utf8')
    } catch {}
  }
  return legacyContentMarkdown
}

// 简单 Markdown 转 HTML（仅用于回填，不依赖 Shiki）
function simpleMarkdownToHtml(md) {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '<a href="#">$1</a>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
}

async function main() {
  console.log('开始回填文章的 contentHtml 和 searchText...')

  const articles = await prisma.article.findMany({
    where: {
      OR: [
        { legacyContentHtml: null },
        { searchText: null },
      ],
    },
    select: {
      id: true,
      title: true,
      excerpt: true,
      contentPath: true,
      legacyContentMarkdown: true,
    },
  })

  console.log(`找到 ${articles.length} 篇需要回填的文章`)

  let success = 0
  let failed = 0

  for (const article of articles) {
    try {
      const markdown = await readMarkdown(article.contentPath, article.legacyContentMarkdown)
      if (!markdown) {
        console.warn(`文章 ${article.id} 无 Markdown 内容，跳过`)
        failed++
        continue
      }

      const contentHtml = simpleMarkdownToHtml(markdown)
      const searchText = buildSearchText(article.title, article.excerpt ?? '', markdown)

      await prisma.article.update({
        where: { id: article.id },
        data: { legacyContentHtml: contentHtml, searchText },
      })

      success++
      if (success % 10 === 0) {
        console.log(`已处理 ${success} 篇...`)
      }
    } catch (error) {
      console.error(`文章 ${article.id} 回填失败:`, error.message)
      failed++
    }
  }

  console.log(`\n完成！成功：${success}，失败：${failed}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
