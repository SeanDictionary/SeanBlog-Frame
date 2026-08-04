# 数据模型与数据库设计

## 1. 概述

数据库采用 PostgreSQL，ORM 使用 Prisma。以下定义的模型映射到 Prisma schema，关系、索引、约束均以 Prisma 语法描述。

当前项目采用**单管理员模式**：数据库只维护一个固定用户名为 `admin` 的后台账号，不实现多用户注册、OAuth 账户绑定、角色枚举、文章作者归属或用户禁言。公开访客不进入 `User` 表，评论系统后续通过游客信息字段独立建模。

核心设计原则：

- 使用 `cuid()` 作为主键，避免自增 ID 暴露和 UUID 性能问题
- 所有关键查询字段建立索引
- 软删除语义通过状态枚举控制，而非 `deletedAt` 字段
- 外键关系明确 `onDelete` 行为，防止级联删除意外
- SEO 相关字段内聚在 Article 模型中，避免过度归一化
- 先保持 MVP 数据模型精简，评论、媒体、站点设置等能力在后续阶段通过迁移追加

## 2. 枚举类型

```prisma
enum ArticleStatus {
  DRAFT      // 草稿（仅管理员后台可见）
  PUBLISHED  // 已发布（公开）
  ARCHIVED   // 归档（URL 保留但不出现在列表中）
}
```

说明：

- 不定义 `UserRole`，因为后台只有唯一管理员
- 评论状态枚举在评论系统进入 Phase 2 时再追加

## 3. 核心模型

### 3.1 User（唯一管理员）

```prisma
model User {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

说明：

- `username` 固定使用 `admin`
- `passwordHash` 必填，密码使用 `bcryptjs` hash 存储
- 不保存邮箱、头像、角色、禁言状态或 OAuth 账户信息
- 管理员密码通过 `scripts/initialize-admin.mjs` 初始化，必要时通过重置脚本更新

### 3.2 Category（一对多）

```prisma
model Category {
  id          String    @id @default(cuid())
  name        String    @unique
  slug        String    @unique
  description String?
  sortOrder   Int       @default(0)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  articles    Article[]

  @@index([slug])
}
```

说明：

- 一个分类下有多个文章
- `sortOrder` 控制前台展示顺序

### 3.3 Tag（多对多）

```prisma
model Tag {
  id        String       @id @default(cuid())
  name      String       @unique
  slug      String       @unique

  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  articles  ArticleTag[]

  @@index([slug])
}
```

### 3.4 Article

```prisma
model Article {
  id                    String        @id @default(cuid())
  title                 String
  slug                  String        @unique
  excerpt               String?
  contentPath           String?       // content/articles/{articleId}/index.md
  legacyContentMarkdown String?       @map("contentMarkdown") // 迁移期回退来源
  legacyContentHtml     String?       @map("contentHtml")     // 迁移期回退来源
  coverImage            String?
  status                ArticleStatus @default(DRAFT)

  metaTitle             String?
  metaDescription       String?
  metaKeywords          String?

  isPinned              Boolean       @default(false)
  publishedAt           DateTime?
  expiresAt             DateTime?
  viewCount             Int           @default(0)
  visitorCount          Int           @default(0)

  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  categoryId            String?
  category              Category?     @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  tags                  ArticleTag[]

  @@index([status, publishedAt])
  @@index([categoryId])
  @@index([isPinned, publishedAt])
}
```

设计说明：

- Markdown 正文以 `content/articles/{articleId}/index.md` 文件为唯一权威源；`contentPath` 保存该相对路径，因此 slug 改动不会重命名正文文件
- 文章详情/后台编辑按需读取 Markdown 文件；`contentHtml` 为运行时渲染结果，可由缓存层缓存，但不是持久化源数据
- `legacyContentMarkdown` / `legacyContentHtml` 映射旧数据库列，仅用于迁移期回退与导出；所有存量文件迁移完成、验证备份后可用后续迁移删除
- 修订正文同样保存在 `content/articles/{articleId}/revisions/{revisionId}.md`，数据库仅保留修订元数据和相对路径；后台编辑器可读取历史版本并恢复到当前编辑区，保存后才覆盖正文
- SEO 字段 (`metaTitle` / `metaDescription` / `metaKeywords`) 为可选，fallback 到文章标题和摘要
- `viewCount` 使用数据库字段，后续可改用 Redis HLL 异步更新
- `visitorCount` 预留给后台文章列表展示浏览人数，后续统计功能接入后由访问事件聚合更新
- `isPinned` 配合 `publishedAt` 索引，用于首页置顶查询
- `expiresAt` 用于定时过期；公开查询仅展示 `publishedAt <= now` 且 `expiresAt` 为空或晚于当前时间的已发布文章
- `onDelete: SetNull` 在 Category 上，删除分类不会删除文章
- 不保存 `authorId`，因为所有后台内容均由唯一管理员维护

### 3.5 ArticleTag（显式多对多关联表）

```prisma
model ArticleTag {
  articleId String
  tagId     String

  article   Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
  tag       Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([articleId, tagId])
  @@index([tagId])
}
```

说明：

- 使用显式关联表而非隐式多对多，便于未来在关联记录上扩展字段
- `onDelete: Cascade`：删除文章或标签时自动清理关联记录

## 4. 阶段扩展表（Phase 2+）

以下表不在 MVP 范围内，后续通过 Prisma 迁移追加。追加时仍默认遵循单管理员模式，不引入多作者或多角色，除非项目需求重新变更。

### 4.1 Comment（嵌套评论）

```prisma
enum CommentStatus {
  PENDING   // 待审核
  APPROVED  // 已通过
  SPAM      // 垃圾
  TRASHED   // 已删除（软删）
}

model Comment {
  id        String        @id @default(cuid())
  content   String
  status    CommentStatus @default(PENDING)
  ip        String?
  userAgent String?

  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  articleId String
  article   Article       @relation(fields: [articleId], references: [id], onDelete: Cascade)

  guestName  String?
  guestEmail String?

  parentId   String?
  parent     Comment?     @relation("CommentReplies", fields: [parentId], references: [id], onDelete: SetNull)
  replies    Comment[]    @relation("CommentReplies")

  isSpam     Boolean      @default(false)

  @@index([articleId, status, createdAt])
  @@index([parentId])
  @@index([guestEmail])
}
```

嵌套设计说明：

- `parentId` 自引用，支持无限层级嵌套（实际读取时使用递归查询或在应用层构建树）
- 游客评论通过 `guestName` / `guestEmail` 标识，不依赖登录用户表
- `status` 字段控制审核状态（PENDING / APPROVED / SPAM / TRASHED）
- `isSpam` 标记用于反垃圾策略

### 4.2 ArticleRevision（文章修订历史）

```prisma
model ArticleRevision {
  id                    String   @id @default(cuid())
  articleId             String
  article               Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
  title                 String
  contentPath           String?  // content/articles/{articleId}/revisions/{revisionId}.md
  legacyContentMarkdown String?  @map("contentMarkdown") // 迁移期回退来源
  legacyContentHtml     String?  @map("contentHtml")     // 迁移期回退来源
  version               Int
  changeNote            String?
  createdAt             DateTime @default(now())

  @@index([articleId, version])
}
```

### 4.3 Media（媒体库）

```prisma
model Media {
  id        String   @id @default(cuid())
  filename  String
  url       String
  key       String
  size      Int
  mimeType  String
  width     Int?
  height    Int?
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```

说明：

- 不设置 `userId`，因为媒体均由唯一管理员上传
- 如后续需求改为多账号模式，再通过迁移追加上传者字段

### 4.4 SiteSetting（站点设置）

```prisma
model SiteSetting {
  id    String @id @default(cuid())
  key   String @unique
  value String // JSON string
}
```

### 4.5 AnalyticsEvent（访问统计事件）

```prisma
model AnalyticsEvent {
  id                 String   @id @default(cuid())
  path               String
  contentType        String
  articleId          String?
  categoryId         String?
  tagId              String?
  visitorHash        String?
  sessionId          String?
  referrer           String?
  country            String?
  ipAddress          String?
  userAgent          String?
  browserFingerprint String?
  hardware           String?
  durationSeconds    Int?
  createdAt          DateTime @default(now())

  article            Article?  @relation(fields: [articleId], references: [id], onDelete: SetNull)
  category           Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  tag                Tag?      @relation(fields: [tagId], references: [id], onDelete: SetNull)

  @@index([createdAt])
  @@index([articleId, createdAt])
  @@index([categoryId, createdAt])
  @@index([tagId, createdAt])
  @@index([contentType, createdAt])
  @@index([visitorHash])
}
```

说明：

- 统计事件记录访问路径、内容类型、关联文章/分类/标签和访问时长
- `visitorHash` 使用匿名访客 ID 的 hash 值，用于访客数去重，不保存原始访客 ID
- `ipAddress`、`userAgent`、`browserFingerprint`、`hardware`、`referrer` 等隐私字段默认不采集，仅在后台设置中显式开启后写入
- 后台统计页按日期、文章、分类、标签聚合访问量和访客数，并支持 CSV 明细导出

## 5. 索引策略总结

| 表 | 索引字段 | 用途 |
|----|----------|------|
| User | `username` | 管理员登录查询 |
| Category | `slug` | 前台分类页查询 |
| Tag | `slug` | 前台标签页查询 |
| Article | `slug` | 文章详情页查询 |
| Article | `status, publishedAt` | 文章列表排序筛选与定时发布过滤 |
| Article | `expiresAt` | 定时过期过滤 |
| Article | `categoryId` | 分类下文章查询 |
| Article | `isPinned, publishedAt` | 首页置顶文章 |
| ArticleTag | `tagId` | 标签下文章查询 |
| Comment | `articleId, status, createdAt` | 文章评论筛选排序 |
| Comment | `parentId` | 嵌套回复查询 |
| Comment | `guestEmail` | 反垃圾查询 |
| ArticleRevision | `articleId, version` | 文章版本历史查询 |
| Media | `createdAt` | 媒体库时间排序 |

## 6. 迁移与版本管理

- `prisma/schema.prisma` 是数据模型的唯一真实来源
- 所有迁移通过 `npx prisma migrate dev --name <描述>` 生成
- `prisma/migrations/` 目录必须纳入版本控制
- 管理员账号通过 `scripts/initialize-admin.mjs` 在生产启动时确保存在，不再维护 Prisma seed 脚本
- 生产首次部署时，`scripts/initialize-content.mjs` 会在文章表为空时创建一篇欢迎文章；已有文章时不会重复创建或覆盖内容
- Prisma Client 类型在 `prisma generate` 后自动生成，由 `node_modules/` 忽略规则覆盖
