import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const md = (title, body) => `# ${title}\n\n${body}`

const articles = [
  {
    title: 'React Server Components 实践指南',
    slug: 'react-server-components-guide',
    excerpt: '深入理解 RSC 的工作原理，从数据获取到流式渲染的完整实践。',
    coverImage: 'https://picsum.photos/seed/rsc/800/450',
    content: md('React Server Components 实践指南', `
React Server Components（RSC）是 React 架构的一次重大变革。本文从实际项目出发，探讨如何在 Next.js App Router 中正确使用 RSC。

## 什么是 Server Components

Server Components 是在服务端渲染的 React 组件，它们不会被打包到客户端 JS 中。这意味着：

- 零客户端 JS 开销
- 直接访问后端资源（数据库、文件系统）
- 不能使用 useState、useEffect 等客户端 API

\`\`\`tsx
async function ArticleList() {
  const articles = await db.article.findMany()
  return articles.map(a => <ArticleCard key={a.id} article={a} />)
}
\`\`\`

## 数据获取模式

> [!NOTE]
RSC 中数据获取是并行的，合理使用 Promise.all 可以显著提升性能。

\`\`\`tsx
const [articles, comments, tags] = await Promise.all([
  getArticles(),
  getComments(),
  getTags(),
])
\`\`\`

## Client Components 与 Server Components 的交互

Client Components 通过 props 接收 Server Components 传递的数据。不能在 Server Component 中使用事件处理器。

> [!WARNING]
不要在 Server Component 中使用 onClick、onChange 等客户端事件处理器。

## 流式渲染

使用 Suspense 边界实现流式渲染：

\`\`\`tsx
<Suspense fallback={<Skeleton />}>
  <SlowComponent />
</Suspense>
\`\`\`
`),
    category: '前端开发', tags: ['React', 'Next.js', '性能优化'], isPinned: true,
  },
  {
    title: '从零搭建 TypeScript Monorepo',
    slug: 'typescript-monorepo-from-scratch',
    excerpt: '使用 Turborepo + pnpm workspace 搭建高效 TypeScript Monorepo 的完整流程。',
    coverImage: 'https://picsum.photos/seed/mono/800/450',
    content: md('从零搭建 TypeScript Monorepo', `
Monorepo 是管理多个相互关联的包的有效方式。

## 初始化 Workspace

\`\`\`bash
mkdir my-monorepo && cd my-monorepo
pnpm init
\`\`\`

在 \`package.json\` 中添加 workspace 配置：

\`\`\`json
{
  "workspaces": ["packages/*", "apps/*"]
}
\`\`\`

## 添加 Turborepo

> [!TIP]
Turborepo 的缓存机制可以显著加速重复构建。

\`\`\`bash
pnpm add -Dw turbo
\`\`\`

## TypeScript 配置

使用 Project References 实现增量编译：

\`\`\`json
{
  "references": [
    { "path": "./packages/ui" },
    { "path": "./packages/utils" }
  ]
}
\`\`\`
`),
    category: '工程化', tags: ['TypeScript', 'Monorepo', 'Turborepo'],
  },
  {
    title: 'CSS 容器查询：响应式设计的新时代',
    slug: 'css-container-queries',
    excerpt: '告别媒体查询，用容器查询实现真正的组件级响应式布局。',
    coverImage: 'https://picsum.photos/seed/css/800/450',
    content: md('CSS 容器查询', `
容器查询（Container Queries）允许组件根据父容器大小调整样式。

## 基础用法

\`\`\`css
.card {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card-title {
    font-size: 2rem;
  }
}
\`\`\`

> [!IMPORTANT]
容器查询改变了响应式设计的思维方式：从"视口响应"到"容器响应"。

## 浏览器兼容性

> [!CAUTION]
容器查询在旧版浏览器中不支持，需要考虑降级方案。
`),
    category: '前端开发', tags: ['CSS', '响应式设计'],
  },
  {
    title: 'PostgreSQL 性能调优实战',
    slug: 'postgresql-performance-tuning',
    excerpt: '从慢查询分析到索引优化，分享 PostgreSQL 性能调优的实战经验。',
    coverImage: 'https://picsum.photos/seed/pg/800/450',
    content: md('PostgreSQL 性能调优实战', `
数据库性能是后端系统的核心瓶颈之一。

## 慢查询分析

使用 \`EXPLAIN ANALYZE\` 分析查询计划：

\`\`\`sql
EXPLAIN ANALYZE
SELECT * FROM articles
WHERE status = 'PUBLISHED'
ORDER BY published_at DESC
LIMIT 20;
\`\`\`

> [!NOTE]
关注 Seq Scan 和 Nested Loop 这两个常见性能杀手。

## 索引优化

### 部分索引

\`\`\`sql
CREATE INDEX idx_published_articles
ON articles (published_at DESC)
WHERE status = 'PUBLISHED';
\`\`\`

> [!TIP]
部分索引可以大幅减少索引大小和写入开销。
`),
    category: '后端开发', tags: ['PostgreSQL', '性能优化', '数据库'],
  },
  {
    title: 'Docker Compose 多环境配置最佳实践',
    slug: 'docker-compose-multi-env',
    excerpt: '使用 Docker Compose 的 override 机制管理开发、测试、生产多环境配置。',
    coverImage: 'https://picsum.photos/seed/docker/800/450',
    content: md('Docker Compose 多环境配置', `
Docker Compose 的 override 机制是管理多环境配置的利器。

## 基础结构

\`\`\`
docker-compose.yml
docker-compose.dev.yml
docker-compose.prod.yml
\`\`\`

> [!WARNING]
生产环境务必移除 volume 映射中的源代码目录。

## 环境变量管理

> [!CAUTION]
永远不要将 .env 文件提交到版本控制系统。
`),
    category: '运维部署', tags: ['Docker', 'DevOps', '部署'],
  },
  {
    title: 'Web 安全防护清单',
    slug: 'web-security-checklist',
    excerpt: 'XSS、CSRF、SQL 注入、CSP —— Web 应用安全防护的全面清单。',
    coverImage: 'https://picsum.photos/seed/security/800/450',
    content: md('Web 安全防护清单', `
安全是 Web 应用不可忽视的方面。

## XSS 防护

> [!IMPORTANT]
XSS 是最常见的 Web 安全漏洞。

### CSP 策略

\`\`\`http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
\`\`\`

## SQL 注入

> [!WARNING]
永远不要拼接 SQL 字符串！使用参数化查询。
`),
    category: '后端开发', tags: ['安全', 'XSS', 'CSP'], isPinned: true,
  },
  {
    title: 'Git 高级技巧：Rebase 与 Cherry Pick',
    slug: 'git-advanced-rebase-cherry-pick',
    excerpt: '掌握 Git rebase 和 cherry-pick，让提交历史更清晰。',
    coverImage: 'https://picsum.photos/seed/git/800/450',
    content: md('Git 高级技巧', `
Git 的 rebase 和 cherry-pick 是保持提交历史整洁的利器。

## Interactive Rebase

\`\`\`bash
git rebase -i HEAD~5
\`\`\`

> [!TIP]
在 interactive rebase 中可以 squash、reword、reorder 提交。

## Cherry Pick

\`\`\`bash
git cherry-pick <commit-hash>
\`\`\`

> [!CAUTION]
永远不要对已推送的公共分支执行 rebase！
`),
    category: '工程化', tags: ['Git', '版本控制'],
  },
  {
    title: 'Tailwind CSS v4 新特性解析',
    slug: 'tailwind-css-v4-features',
    excerpt: 'Tailwind CSS v4 带来了引擎重写、CSS 变量原生支持和更快的构建速度。',
    coverImage: 'https://picsum.photos/seed/tw/800/450',
    content: md('Tailwind CSS v4 新特性', `
Tailwind CSS v4 是一次重大升级。

## CSS 变量原生支持

> [!IMPORTANT]
v4 默认使用 CSS 变量实现颜色系统，暗色模式切换更简单。

\`\`\`css
@theme {
  --color-accent: #cf829e;
  --font-sans: ui-monospace, monospace;
}
\`\`\`

## 零配置内容检测

> [!TIP]
构建速度比 v3 快 5-10 倍。
`),
    category: '前端开发', tags: ['Tailwind', 'CSS'],
  },
]

const comments = [
  { articleIdx: 0, content: 'RSC 的并行数据获取那段很有启发，之前一直串行 await。', status: 'APPROVED', guestName: '开发者A' },
  { articleIdx: 0, content: 'Suspense 流式渲染确实能大幅改善首屏体验。', status: 'APPROVED', guestName: '前端小明' },
  { articleIdx: 0, content: '想补充一点：RSC 中不能使用 Context，需要通过 props 传递。', status: 'APPROVED', guestName: 'React爱好者' },
  { articleIdx: 3, content: '部分索引那条建议非常实用，之前没注意到。', status: 'APPROVED', guestName: 'DBA老王' },
  { articleIdx: 3, content: '连接池配置能再详细讲讲 PgBouncer 的 transaction mode 吗？', status: 'PENDING', guestName: '运维小哥' },
  { articleIdx: 5, content: 'CSP 策略那块值得单独写一篇深入讲。', status: 'APPROVED', guestName: '安全研究员' },
  { articleIdx: 6, content: 'rebase -i 是神器，但团队协作时还是要约定好分支策略。', status: 'APPROVED', guestName: 'Tech Lead' },
  { articleIdx: 7, content: 'v4 的构建速度提升确实明显，迁移过程很顺利。', status: 'APPROVED', guestName: 'CSS玩家' },
]

async function main() {
  const categoryNames = [...new Set(articles.map(a => a.category))]
  const categoryMap = {}
  for (const name of categoryNames) {
    const slug = name.toLowerCase().replace(/\s+/g, '-')
    categoryMap[name] = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name, slug, description: name + '相关文章' },
    })
  }
  console.log('Categories:', Object.keys(categoryMap).length)

  const tagNames = [...new Set(articles.flatMap(a => a.tags))]
  const tagMap = {}
  for (const name of tagNames) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-')
    tagMap[name] = await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    })
  }
  console.log('Tags:', Object.keys(tagMap).length)

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    const category = categoryMap[a.category]
    const existing = await prisma.article.findFirst({ where: { slug: a.slug } })
    if (existing) {
      await prisma.article.update({
        where: { id: existing.id },
        data: {
          title: a.title, excerpt: a.excerpt, coverImage: a.coverImage,
          legacyContentMarkdown: a.content, status: 'PUBLISHED',
          isPinned: a.isPinned ?? false,
          publishedAt: new Date(Date.now() - (articles.length - i) * 86400000),
          categoryId: category.id,
          viewCount: Math.floor(Math.random() * 500) + 50,
          visitorCount: Math.floor(Math.random() * 200) + 20,
        }
      })
      await prisma.articleTag.deleteMany({ where: { articleId: existing.id } })
      for (const tagName of a.tags) {
        await prisma.articleTag.create({ data: { articleId: existing.id, tagId: tagMap[tagName].id } })
      }
      continue
    }
    const article = await prisma.article.create({
      data: {
        title: a.title, slug: a.slug, excerpt: a.excerpt, coverImage: a.coverImage,
        legacyContentMarkdown: a.content, status: 'PUBLISHED',
        isPinned: a.isPinned ?? false,
        publishedAt: new Date(Date.now() - (articles.length - i) * 86400000),
        categoryId: category.id,
        viewCount: Math.floor(Math.random() * 500) + 50,
        visitorCount: Math.floor(Math.random() * 200) + 20,
      }
    })
    for (const tagName of a.tags) {
      await prisma.articleTag.create({ data: { articleId: article.id, tagId: tagMap[tagName].id } })
    }
  }
  console.log('Articles:', articles.length)

  let commentCount = 0
  for (const c of comments) {
    const articleSlug = articles[c.articleIdx].slug
    const article = await prisma.article.findFirst({ where: { slug: articleSlug } })
    if (!article) continue
    const existing = await prisma.comment.findFirst({ where: { articleId: article.id, content: c.content } })
    if (existing) continue
    await prisma.comment.create({
      data: {
        content: c.content, status: c.status, guestName: c.guestName,
        articleId: article.id,
        createdAt: new Date(Date.now() - Math.random() * 7 * 86400000),
      }
    })
    commentCount++
  }
  console.log('Comments:', commentCount, 'new')

  for (let i = 0; i < 5; i++) {
    const visitorId = 'test-visitor-' + i + '-' + Date.now()
    await prisma.visitor.upsert({
      where: { visitorId },
      update: {},
      create: {
        visitorId,
        visitCount: Math.floor(Math.random() * 20) + 1,
        firstSeenAt: new Date(Date.now() - Math.random() * 30 * 86400000),
        lastSeenAt: new Date(Date.now() - Math.random() * 86400000),
      }
    })
  }
  console.log('Visitors: 5')
  console.log('\nDone!')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
