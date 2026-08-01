import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const WELCOME_ARTICLE = {
  title: '欢迎使用 SeanBlog Frame',
  slug: 'welcome-to-seanblog-frame',
  excerpt: '这是系统首次部署时自动创建的欢迎文章，你可以在后台编辑或删除它。',
  markdown: `# 欢迎使用 SeanBlog Frame

这是系统首次部署时自动创建的欢迎文章。

你可以登录后台完成以下操作：

1. 修改站点名称和描述。
2. 编辑或删除这篇示例文章。
3. 创建自己的第一篇正式文章。
4. 按需配置主题和站点信息。

## 下一步

进入后台后，建议先检查站点设置，然后开始写作。
`,
}

function createPrisma() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.')
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })
}

function getArticleContentPath(articleId) {
  return `content/articles/${articleId}/index.md`
}

function getArticleRevisionContentPath(articleId, revisionId) {
  return `content/articles/${articleId}/revisions/${revisionId}.md`
}

async function writeMarkdown(contentPath, markdown) {
  const absolutePath = path.resolve(process.cwd(), ...contentPath.split('/'))

  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, markdown, 'utf8')
}

async function removeArticleContent(articleId) {
  await rm(path.resolve(process.cwd(), 'content', 'articles', articleId), {
    recursive: true,
    force: true,
  })
}

export async function createWelcomeArticleIfMissing() {
  const prisma = createPrisma()
  let articleId = null

  try {
    const existingArticleCount = await prisma.article.count()

    if (existingArticleCount > 0) {
      console.log('Article content already exists. Skipping welcome article initialization.')
      return false
    }

    const article = await prisma.article.create({
      data: {
        title: WELCOME_ARTICLE.title,
        slug: WELCOME_ARTICLE.slug,
        excerpt: WELCOME_ARTICLE.excerpt,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })
    articleId = article.id

    const contentPath = getArticleContentPath(article.id)
    await writeMarkdown(contentPath, WELCOME_ARTICLE.markdown)

    const revision = await prisma.articleRevision.create({
      data: {
        articleId: article.id,
        title: article.title,
        version: 1,
        changeNote: 'Initial welcome article',
      },
    })
    const revisionContentPath = getArticleRevisionContentPath(article.id, revision.id)
    await writeMarkdown(revisionContentPath, WELCOME_ARTICLE.markdown)

    await prisma.$transaction([
      prisma.article.update({
        where: { id: article.id },
        data: { contentPath },
      }),
      prisma.articleRevision.update({
        where: { id: revision.id },
        data: { contentPath: revisionContentPath },
      }),
    ])

    console.log(`Welcome article created: ${WELCOME_ARTICLE.slug}`)
    return true
  } catch (error) {
    if (articleId) {
      await prisma.article.delete({ where: { id: articleId } }).catch(() => undefined)
      await removeArticleContent(articleId).catch(() => undefined)
    }

    throw error
  } finally {
    await prisma.$disconnect()
  }
}

await createWelcomeArticleIfMissing()
