# 系统架构设计

## 1. 架构概览

本系统采用 Next.js 单体全栈架构，前端、后台与 API 共享同一应用进程和类型系统，不引入独立后端服务。后台通过 `AdminIdentityBootstrap` 在页面注入访客指纹/硬件 cookie（由 `src/lib/client/identity.ts` 生成），用于无登录态下的访客识别与访问记录归因；主题样式经 `buildThemeCssBundle()` 统一构建，前台 `(public)/layout.tsx` 与 `/api/admin/articles/preview` 共用同一 CSS 包，确保编辑器预览与线上样式一致。

整体架构逻辑分层如下：

```
浏览器 / 客户端
        │
 ┌──────▼─────────────────────────────────────┐
 │           Next.js (单体全栈)                 │
 │                                             │
 │  ┌────────────────┐  ┌────────────────────┐ │
 │  │ Blog 前台       │  │ Admin 后台          │ │
 │  │ (SSR/ISR/SSG)  │  │ (RSC + Server       │ │
 │  │ 服务端组件只读  │  │  Actions 写)        │ │
 │  └───────┬────────┘  └─────────┬──────────┘ │
 │          │                     │             │
 │  ┌───────▼─────────────────────▼──────────┐ │
 │  │           Service 服务层                │ │
 │  │  article / comment / category /        │ │
 │  │  tag / user / search / seo / storage   │ │
 │  └───────────────────┬───────────────────┘ │
 │                      │                      │
 │  ┌───────────────────▼───────────────────┐ │
 │  │        数据访问层 (Prisma Client)       │ │
 │  └───────────────────┬───────────────────┘ │
 │                      │                      │
 │  ┌───────────────────▼───────────────────┐ │
 │  │      外部服务 (按阶段接入)              │ │
 │  │  Redis 缓存    Meilisearch             │ │
 │  │  Sentry 监控            │ │
 │  └───────────────────────────────────────┘ │
 └────────────────────────────────────────────┘
```

## 2. 核心设计决策

### 2.1 为什么选择单体全栈

- 单人项目不需要微服务级别的部署复杂度
- Next.js 的 Server Components、Server Actions、Route Handlers 覆盖了前端渲染、后台 API、表单提交的全部场景
- 类型系统从数据库到 UI 层共享，Prisma 生成的类型可以直接传递到前端
- 单仓库 + 单进程让本地开发、CI 构建、Docker 部署统一简化

### 2.2 Server Actions vs Route Handlers 的分工

**Server Actions** 用于：

- 后台管理中的所有表单提交（创建/编辑/删除文章、分类、标签）
- 需要管理员身份的写操作

**Route Handlers** (`/api/*`) 用于：

- Auth.js 回调路由
- 公开评论提交（游客、无需 auth 上下文但需要反垃圾处理）
- 图片上传回调
- 未来的 webhook 入口或外部服务回调

基本原则：能走 Server Action 的业务逻辑不走 Route Handler，除非是 auth 回调、外部集成等必须的场景。

### 2.3 前台与后台架构边界

前台 Blog：

- 全部为 Server Components 优先
- 服务端直调 service 层 → Prisma → PostgreSQL
- 文章详情页使用 ISR（`generateStaticParams` + `revalidate`）
- 列表页使用 ISR，分类/标签/搜索按策略处理
- 对构建无依赖的页面不依赖 `generateStaticParams`，保证新内容传播及时性

后台 Admin：

- 布局与导航为 Server Components
- 数据展示优先使用 Server Components 直接查询
- 表单提交使用 Server Actions（利用 React `useFormStatus` / `useActionState`）
- 富交互部分使用 Client Components（如 Markdown 编辑器、搜索筛选、确认弹窗）

## 3. 服务层设计

服务层 (`src/lib/services/`) 是 Prisma 之上的统一业务抽象：

| 服务 | 职责 |
|------|------|
| `articleService` | 文章 CRUD，slug 生成与唯一性校验，markdown → HTML 编译，状态流转 |
| `categoryService` | 分类 CRUD，slug 唯一性 |
| `tagService` | 标签 CRUD，slug 唯一性 |
| `commentService` | 评论提交，嵌套回复构建，审核流转，反垃圾标记 |
| `adminAuthService` | 管理员登录、密码重置与后台访问校验 |
| `seoService` | sitemap 生成，robots 策略，结构化数据 JSON-LD 生成 |
| `searchService` | 搜索统一接口（Phase 1：PG tsvector；Phase 2：Meilisearch） |
| `analytics-service.ts` | 分析统计核心逻辑（趋势、总览、访客、访问记录） |
| `setting-service.ts` | 站点设置读写 |
| `comment-moderation-rules.ts` | 评论审核规则 |
| `comment-settings.ts` | 评论模式设置 |
| `geoip.ts` | IP 到国家/地区查询（ipinfo.io lite API） |

服务层的存在是为了：

- 让 Server Components 和 Server Actions 不直接依赖 Prisma 调用细节
- 方便后续替换底层实现（例如从 PG FTS 切到 Meilisearch 时只改 `searchService`）
- 统一处理事务、缓存失效和权限检查入口

## 4. 数据流

### 4.1 前台读路径

```
用户请求 → Next.js 路由 → Server Component
  → service 层 → Prisma Client → PostgreSQL
  → 组件渲染 → HTML 返回
  → (ISR 缓存命中则直接返回缓存)
```

### 4.2 后台写路径

```
用户操作 → Client Component → Server Action
  → requireAdmin() 校验 → Zod 校验
  → service 层 → Prisma Client → PostgreSQL
  → revalidatePath / revalidateTag
  → 返回结果 / redirect
```

### 4.3 公开 API 路径

```
请求 → /api/* Route Handler
  → 可选 auth 解析（不强制）
  → Zod 校验 → service 层 → Prisma Client
  → JSON Response
```

公开页面由 `(public)/*/route.ts` 经 `render-service.ts` 渲染 Handlebars 主题模板返回 HTML。`render-service.ts` 预计算 `platform_enhance` ctx 字符串（包含 `enhance.js` 与 `analytics.js` 两个 `<script defer>`），主题模板通过 `{{{platform_enhance}}}` 输出，无需主题包单独引用。`/analytics.js` 为 vanilla 访问埋点脚本，在 `pagehide` / `visibilitychange→hidden` 时通过 `navigator.sendBeacon` 上报 `/api/analytics/events`，身份生成与 `src/lib/client/identity.ts` 共用 localStorage key 与 fingerprint/hardware 格式。

## 5. 认证与授权架构

采用 Auth.js v5 + Credentials Provider + JWT session 策略，服务于唯一管理员登录：

- `src/lib/auth.ts`：Auth.js 配置入口
- `src/lib/auth.config.ts`：独立配置供 middleware 使用
- `src/lib/auth.utils.ts`：`requireAdmin` / `isAdminAuthenticated` 等服务端工具函数
- `proxy.ts` / middleware：保护 `/admin/*` 路径，检查 session 有效性

为什么不使用数据库 session？因为当前单管理员模式只需要二元后台鉴权，JWT session 策略足够表达“是否为已登录管理员”，也避免引入 Account / Session / VerificationToken 等额外表。

## 6. 工程目录约定

```
src/
  app/          # App Router 路由（前后台共用）
  components/
    ui/         # 共享 UI 原语（Card, Button, Badge, EmptyState, ExportCsvButton, LinkButton）
    admin/admin-identity-bootstrap.tsx  # 后台指纹/硬件 cookie 注入
    admin/analytics-dashboard.tsx        # 访问记录表格 + 详情对话框
    admin/analytics-trend-chart.tsx     # 交互式 SVG 趋势图表
    common/external-link.tsx            # 外部链接确认模态框
  lib/          # 核心基础设施
    prisma.ts   # Prisma 客户端单例
    auth.ts     # Auth.js 配置
    auth.config.ts
    auth.utils.ts   # 单管理员鉴权工具函数
    env.ts      # 环境变量 Zod 校验
    utils.ts    # 通用工具函数
    format.ts   # 集中式日期/时长格式化函数（formatDateTime, formatDate, formatDurationShort 等）
    geoip.ts    # ipinfo.io lite 地区查询
    validations/ # Zod schema 文件
    services/   # 业务服务层
    content/    # 内容处理模块（markdown.ts 渲染管线、article-content.ts 文件管理、reading-time.ts 阅读时间计算）
    theme/      # 主题相关模块目录
      css-bundle.ts # 主题 CSS 包构建（前台布局与编辑器预览共用）
    client/identity.ts # 客户端访客 ID/指纹/硬件辅助函数
  hooks/        # 客户端 react hooks
  styles/       # 全局样式与 markdown 渲染样式
```

## 7. 未来扩展边界

以下能力在架构上预留了接口，但不阻塞 MVP。

### 7.1 缓存层

通过 `searchService` 和 `articleService` 预留缓存注入点。MVP 不引入 Redis，后续接入时：

- 在 service 层内部加入缓存读取/失效逻辑
- 上层 Server Component 和 Server Action 不受影响

### 7.2 搜索引擎

`searchService` 是搜索的统一入口。MVP 使用 PostgreSQL 原生的 `tsvector` + `websearch_to_tsquery` 实现全文搜索。当前内置搜索交互支持用空格或 `+` 拆分多个关键词，并按“全部关键词命中”返回结果；搜索弹窗和搜索结果页都应高亮命中的标题/摘要关键词。后续切换到 Meilisearch 或 Typesense 时只需替换 `searchService` 内部实现，不影响前端路由和组件。

### 7.3 图片存储

媒体上传直接写入本地文件系统 `public/uploads/media/`，删除媒体记录时同步删除对应本地文件；未引入对象存储抽象，后续确有 S3 / R2 / MinIO 需求时再以真实实现接入。文章中引用外部 `https://` 图片可直接写在 Markdown 中，无需登记到媒体库。

### 7.4 AI 功能

AI 写作辅助（摘要生成、草稿扩写、标题优化）计划在 Phase 4 接入。届时在服务层新增 `aiService`，负责调用外部 API，不与核心数据库逻辑耦合。
