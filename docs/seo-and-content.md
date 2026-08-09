# SEO 与内容系统设计

## 1. 概述

SEO 是个人博客的核心能力之一。本系统在设计上保证：

- 所有公开内容对搜索引擎可发现、可索引
- metadata / Open Graph / JSON-LD 在路由层级自动生成
- URL 结构稳定、语义化、可预测
- 渲染策略为搜索引擎优化（SSR / ISR / SSG），不为客户端渲染

## 2. Markdown 内容工作流

### 2.1 编辑与存储

- 后台文章编辑器使用 Markdown，提供编辑 / 预览 / 分栏三种模式
- 编辑器为 Client Component，实时预览通过后台预览接口复用正式 Markdown 编译与清洗逻辑
- 编辑器会将未保存内容自动保存到浏览器本地草稿，并在离开页面时提示确认
- 保存时 Markdown 原文写入 `content/articles/{articleId}/index.md`
- PostgreSQL 仅保存文章元数据与相对 `contentPath`，不再将正文作为权威内容源存储
- 后台文章列表的导入/导出使用 `.zip` 文章包：单篇文章导出为 `{slug}.zip`，多篇文章导出为 `articles.zip`；每篇文章包含 `article.json` 元数据、`article.md` 正文，以及可选的 `image/cover.*` 与 `image/article/*` 本地媒体资源
- 导入 ZIP 时服务端会校验路径穿越、条目数量、文件大小、重复 slug、缺失 `article.json` / `article.md`、本地媒体引用缺失和非法媒体类型；导入成功前不会写入数据库记录
- 导出 ZIP 时会将本地上传的封面和正文图片复制到文章包，并把正文中的本地图片路径改写为 `image/article/...`；外链图片保持原 URL

### 2.2 Markdown 编译 Pipeline

服务端编译使用 `unified` + `remark` + `rehype` 工具链：

- `remark-parse`：解析 Markdown
- `remark-gfm`：支持 GFM 语法（表格、任务列表、删除线等）
- `rehype-highlight`：代码块语法高亮（当前内置轻量 token 标记覆盖常见 JS/TS、JSON、HTML、CSS；后续可替换为 Shiki/Prism）
- 编译结果按详情请求即时生成，可由缓存层缓存
- 文章详情页 Server Component 使用经过转义的 HTML 输出渲染

### 2.3 文章状态流转

```
DRAFT → PUBLISHED → ARCHIVED
           ↑            │
           └────────────┘ (可以重新发布)
```

- **DRAFT**：仅管理员后台可见，不出现在任何公开页面
- **PUBLISHED**：公开可访问，出现在文章列表、分类、标签、搜索、sitemap 中；如果 `publishedAt` 是未来时间则到点后才公开
- **ARCHIVED**：URL 保留可访问，但不出现在文章列表和 sitemap 中

### 2.4 Slug 策略

- slug 从文章标题自动生成（中文标题会先做轻量拼音转换，再规范化为 `a-z0-9-`）
- 支持手动编辑
- 唯一性校验：创建/更新文章时检查是否与其他文章 slug 冲突
- 格式建议：`/articles/hello-world` — 语义化路径，不含日期，不给未来迁移造成负担
- 如果未来需要改 slug 策略，可在 Phase 2 加入 `SlugRedirect` 表做 301 重定向

## 3. Metadata 策略

### 3.1 每页面 metadata 生成

每个公开页面 Server Component 均通过 `generateMetadata` 提供页面级 metadata：

**文章详情页**：

- `title`：`metaTitle || title + " | " + siteName`
- `description`：`metaDescription || excerpt || 正文前 160 字`
- `openGraph`：`og:title`, `og:description`, `og:image`（封面图）, `og:type=article`
- `alternates.canonical`：文章的绝对 URL

**分类页/标签页**：

- `title`：分类/标签名称 + " | " + siteName
- `description`：分类描述（或标签文章数摘要）

**首页**：

- `title`：`siteName + " | " + siteTagline`
- `description`：站点描述

### 3.2 全局 metadata fallback

在根 `layout.tsx` 中设置全局默认 metadata：

```typescript
export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  // ...
}
```

### 3.3 Robots meta

公开可索引页面：

```typescript
robots: {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
  },
}
```

后台 `/admin/*` 路径在 middleware 或根 layout 中添加 `X-Robots-Tag: noindex, nofollow` 头。

## 4. Sitemap

通过 Next.js App Router 的 `sitemap.ts` 文件约定动态生成：

```typescript
// app/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await articleService.getAllPublished()
  const categories = await categoryService.getAll()
  const tags = await tagService.getAll()

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    // 文章
    ...articles.map(a => ({
      url: `${baseUrl}/articles/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    // 分类
    ...categories.map(c => ({
      url: `${baseUrl}/categories/${c.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
    // 标签
    ...tags.map(t => ({
      url: `${baseUrl}/tags/${t.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ]
}
```

## 5. Robots.txt

通过 `robots.ts` 文件约定生成：

```typescript
// app/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/admin/',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
```

## 6. 结构化数据（JSON-LD）

文章详情页输出 `BlogPosting` schema：

- 通过 `<script type="application/ld+json">` 注入
- 包含：`headline`, `description`, `datePublished`, `dateModified`, `author`, `image`, `url`
- 后续可扩展面包屑的 `BreadcrumbList` schema

## 7. RSS Feed

在 Phase 2 通过 Route Handler 或文件约定生成：

- `/rss.xml`（或 `/feed.xml`）
- 包含文章标题、摘要、发布日期、作者、链接
- 按发布时间倒序排列最近 N 篇文章
- 通过 ISR `revalidate` 定期更新

## 8. 渲染策略

不同页面采用不同的渲染策略以平衡性能和内容新鲜度：

| 页面类型 | 策略 | revalidate | 说明 |
|----------|------|------------|------|
| 首页（文章列表） | ISR | 300s | 新文章发布后最多 5 分钟上线；未来发布时间由公开查询实时过滤 |
| 文章详情页 | ISR + generateStaticParams | 600s | 热门文章预渲染，冷门文章首次访问时渲染 |
| 分类归档页 | ISR | 300s | 新增文章后更新 |
| 标签归档页 | ISR | 300s | 同上 |
| 搜索结果页 | SSR | 不缓存 | 搜索结果实时性要求高 |
| sitemap.xml | 动态生成 | 按需 | 每次请求动态生成 |
| robots.txt | 静态生成 | - | 内容变化极少 |

## 9. 图片与 SEO

- 封面图建议使用 WebP / AVIF 格式，通过 Next.js `next/image` 组件优化
- 文章内图片使用 alt 文本（Markdown 中 `![alt text](url)`）
- 图片使用延迟加载（`loading="lazy"`）
- 封面图尺寸建议 1200×630（适配 Open Graph）

## 10. 前端语义化

博客前台页面使用语义化 HTML 标签：

- `<article>`：文章卡片和详情
- `<section>`：页面内容区块
- `<nav>`：导航和分页
- `<time>`：发布时间
- `<header>` / `<footer>`：页面头部和底部
- `<main>`：主内容区

## 11. SEO 检查清单

MVP 完成时应确认以下 SEO 要点均覆盖：

- [ ] 首页、文章页、分类页、标签页有独立 `title` 和 `description`
- [ ] 文章页有 `og:title`, `og:description`, `og:image`, `og:type=article`
- [ ] 文章页有 `canonical` URL
- [ ] 文章页有 `BlogPosting` JSON-LD
- [ ] `sitemap.xml` 包含所有已发布文章、分类、标签
- [ ] `robots.txt` 禁止 `/admin`，指向 sitemap
- [ ] 后台 `/admin` 路径返回 `X-Robots-Tag: noindex`
- [ ] 前端使用语义化 HTML 标签
- [ ] 图片有 alt 文本
- [ ] 页面在禁用 JS 的情况下仍可读取主要内容（渐进增强）
