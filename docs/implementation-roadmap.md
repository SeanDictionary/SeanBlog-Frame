# 开发路线图

本文档定义从零到生产级系统的分阶段开发计划。每个阶段有明确的输入、交付物和验收标准，阶段之间按依赖关系推进。

## 阶段总览

| 阶段 | 目标 | 预估时间 | 核心交付 |
|------|------|----------|----------|
| Phase 0 — 项目初始化 | 建立工程骨架 | 1–2 天 | 脚手架、数据库、Docker、基础文档 |
| Phase 1 — MVP | 可用的博客核心 | 1–2 周 | 文章/分类/标签/后台/前台展示 |
| Phase 2 — 完整系统 | 功能完备的 CMS | 2–3 周 | 评论/审核/搜索/媒体/设置/RSS |
| Phase 3 — 生产级 | 可用性和性能 | 2–3 周 | 缓存/监控/限流/CI/CD/备份 |
| Phase 4 — AI 与扩展 | 差异化能力 | 持续 | AI 写作/订阅/多语言/开放 API |

---

## Phase 0 — 项目初始化

**目标**：建立最基本的工程骨架，后续所有阶段可在此基础上增量开发。

### 交付物

- [ ] `npx create-next-app@latest` 初始化项目（TypeScript + App Router + Tailwind CSS + `src/` 目录）
- [ ] Prisma 初始化：安装依赖，创建 `prisma/schema.prisma`（核心表：User, Article, Category, Tag, ArticleTag）
- [ ] 首次数据库迁移：`npx prisma migrate dev`
- [ ] 生产启动脚本确保唯一管理员账户存在，并在文章表为空时初始化一篇欢迎文章
- [ ] `docker-compose.yml`（生产环境的 Next.js + PostgreSQL + 密钥初始化服务）可跑通
- [ ] `.gitignore` 配置
- [ ] `.env.example` 模板文件
- [ ] `README.md` + `docs/` 项目文档体系建立

### 验收标准

- `docker compose up` 后 Next.js 应用启动，数据库连接正常
- `npx prisma studio` 可查看种子数据
- 项目文档在 `docs/` 目录下清晰分类

---

## Phase 1 — MVP

**目标**：完成文章、分类、标签、后台管理、前台展示的最小闭环。

### 1.1 管理员认证

- [ ] Auth.js 配置（Credentials + JWT session）
- [ ] `/admin/login` 登录页
- [ ] `proxy.ts` / middleware 保护 `/admin/*` 路径
- [ ] 单管理员鉴权工具函数（`requireAdmin` / `isAdminAuthenticated`）
- [ ] Admin 共享 layout（侧栏导航 + 鉴权）

### 1.2 文章系统

- [ ] Markdown 编辑器集成（前台 Client Component）
- [ ] `articleService`：创建、编辑、删除、slug 生成
- [ ] 文章状态管理（草稿 / 发布 / 归档）
- [ ] 文章列表页（后台 `/admin/articles`）：支持状态筛选
- [ ] 文章新建/编辑页（后台 `/admin/articles/new`, `/admin/articles/[id]/edit`）
- [ ] SEO meta 字段：`metaTitle`, `metaDescription`, `metaKeywords`
- [ ] 封面图字段（Phase 1 使用本地存储）

### 1.3 分类与标签

- [ ] `categoryService` / `tagService` CRUD
- [ ] 后台分类列表管理（`/admin/categories`）
- [ ] 后台标签列表管理（`/admin/tags`）
- [ ] slug 自动生成与唯一性校验

### 1.4 博客前台

- [ ] 首页：已发布文章列表（分页 + 置顶 + 排序；支持发布时间、更新时间、浏览量、已通过评论数）
- [ ] 文章详情页：`/articles/[slug]`，展示可由后台设置控制的文章元信息（如预估阅读时间）
- [ ] 分类归档页：`/categories/[slug]`
- [ ] 标签归档页：`/tags/[slug]`
- [ ] Markdown → HTML 渲染（`dangerouslySetInnerHTML` + prose 样式）

### 1.5 SEO 基线

- [ ] 首页、文章页、分类页、标签页的 `generateMetadata`
- [ ] `sitemap.ts` 动态生成 sitemap
- [ ] `robots.ts` 生成 robots.txt
- [ ] 语义化 HTML 标签
- [ ] 后台路径 `X-Robots-Tag: noindex`

### 验收标准

- 管理员可登录后台、创建文章、发布文章、管理分类标签
- 前台能浏览文章列表、查看文章详情、按分类和标签筛选
- 文章页面可查看 HTML title、meta description、Open Graph 标签
- `/sitemap.xml` 能正常访问

---

## Phase 2 — 完整 CMS

**目标**：补齐评论系统、图片管理、搜索、RSS 和媒体库，成为功能完备的 CMS。

### 2.1 评论系统

- [ ] 评论数据表迁移（Comment 模型在 Phase 2 追加）
- [ ] 评论提交接口（`/api/comments`）：支持游客评论
- [ ] 嵌套评论渲染（前端递归组件）
- [ ] 后台评论审核（`/admin/comments`）：列表 + 状态变更
- [ ] 评论审核模式配置（通过 SiteSetting）

### 2.2 媒体库

- [ ] `storageService` 封装：本地文件系统（Phase 2） + S3 接口预留
- [ ] `Media` 数据表迁移
- [ ] 图片上传组件（后台文章编辑器内集成）
- [ ] 后台媒体库页面（浏览、删除上传的图片）

### 2.3 文章增强

- [ ] `ArticleRevision` 数据表迁移
- [ ] 文章修改时自动保存版本历史
- [ ] 后台文章编辑页可查看/恢复历史版本（可选）

### 2.4 搜索

- [ ] PostgreSQL `tsvector` 全文搜索（`searchService`）
- [ ] 搜索页：`/search?q=...`（SSR），支持分页和标题/摘要关键词高亮
- [ ] 搜索框组件集成到前台 Header，搜索按钮保持常驻，弹窗居中显示
- [ ] 支持用空格或 `+` 拆分多个关键词，并按全部关键词命中返回结果
- [ ] 文章内容索引自动更新（在 `articleService` 写操作时刷新）

### 2.5 后台增强

- [ ] 仪表盘统计（最近文章数、评论数、待审核数、阅读量趋势）
- [ ] 站点设置页 `/admin/settings`（`SiteSetting` 数据表）

### 2.6 内容分发

- [ ] RSS feed：`/rss.xml`
- [ ] 文章 JSON-LD 结构化数据

### 验收标准

- 游客可在文章下发表评论，支持嵌套回复
- 管理员可在后台审核评论
- 可上传图片并在文章中引用
- 搜索功能可用（标题 + 正文内容搜索）
- RSS 可被阅读器订阅

---

## Phase 3 — 生产级

**目标**：将 MVP 从“功能完备”推到“可以线上长期可靠运行”。

### 3.1 缓存

- [ ] Redis 接入（生产 `docker-compose.yml` 增加 redis 服务）
- [ ] 文章详情缓存（Cache-Aside 模式）
- [ ] 热门文章 / 近期文章缓存
- [ ] 搜索缓存（热门搜索词）

### 3.2 性能与安全

- [ ] Rate limiting：评论 API + 登录 API（`@upstash/ratelimit` 或 Redis 实现）
- [ ] CSRF 保护（Auth.js 内置，确认生效）
- [ ] 图片优化：WebP 自动转换 + `next/image` 懒加载
- [ ] 静态资源长期缓存策略

### 3.3 监控与可观测

- [ ] Sentry 错误监控接入
- [ ] `/api/health` 健康检查端点
- [ ] 基础访问统计（文章阅读量异步更新）

### 3.4 CI/CD

- [ ] GitHub Actions：type check + lint + build
- [ ] Docker 镜像构建并推送到注册表
- [ ] 部署到服务器 / VPS

### 3.5 SEO 与性能审计

- [ ] Lighthouse 分数 ≥ 90（Performance / SEO / Accessibility / Best Practices）
- [ ] `lighthouse-ci` 集成到 CI

### 3.6 运维

- [ ] `pg_dump` 自动备份脚本（cron）
- [ ] 日志收集方案
- [ ] HTTPS 证书自动续期（通过 Caddy / Nginx 反代）

### 验收标准

- Redis 缓存生效，文章详情页加载显著加速
- 评论接口有速率限制
- CI 流水线通过（lint + type check + build）
- Lighthouse SEO 100 分
- 可一键部署到新服务器

---

## Phase 4 — AI 与高级扩展（持续）

**目标**：给系统增加差异化能力，在个人写作效率、读者互动和系统智能方面继续迭代。

### 4.1 AI 写作辅助

- [ ] 接入 OpenAI / Claude API
- [ ] 文章摘要自动生成
- [ ] 标题优化建议
- [ ] 草稿扩写 / 续写
- [ ] 后台编辑器内集成 AI 面板（可选）

### 4.2 搜索升级

- [ ] 从 PG tsvector 迁移到 Meilisearch / Typesense
- [ ] 搜索建议 / 自动补全
- [ ] 搜索结果高亮

### 4.3 订阅与通知

- [ ] 邮件订阅（新文章推送）
- [ ] 评论回复邮件通知
- [ ] RSS 邮件摘要

### 4.4 国际化

- [ ] `next-intl` 集成
- [ ] 前端多语言支持
- [ ] 文章多语言版本

### 4.5 高级分析

- [ ] 阅读量统计（Redis HLL + 异步回写 DB）
- [ ] 读者来源分析
- [ ] 文章阅读时长估算
- [ ] 仪表盘图表化（`recharts`）

### 4.6 开放 API

- [ ] RESTful API 文档
- [ ] API key 管理
- [ ] Rate limit 分级

---

## 依赖关系图

```
Phase 0 (初始化)
  └── Phase 1 (MVP)
        ├── 1.1 认证 ──────────────────────┐
        ├── 1.2 文章 ──────────────────────┤
        ├── 1.3 分类标签 ──────────────────┤
        ├── 1.4 前台博客 ──────────────────┤
        └── 1.5 SEO 基线 ──────────────────┘
              │
              ▼
        Phase 2 (完整 CMS)
        ┌──────┴──────┐
        ├── 2.1 评论 ──┤
        ├── 2.2 媒体库 ─┤
        ├── 2.3 版本历史─┤
        ├── 2.4 搜索 ───┤
        ├── 2.5 后台增强─┤
        └── 2.6 RSS ───┘
              │
              ▼
        Phase 3 (生产级)
        ┌──────┴──────┐
        ├── 3.1 缓存 ──┤
        ├── 3.2 安全 ──┤
        ├── 3.3 监控 ──┤
        ├── 3.4 CI/CD ─┤
        ├── 3.5 审计 ──┤
        └── 3.6 运维 ──┘
              │
              ▼
        Phase 4 (AI + 扩展)
              │
        （持续迭代）
```
