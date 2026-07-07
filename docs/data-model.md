# 数据模型与数据库设计

## 1. 概述

数据库采用 PostgreSQL，ORM 使用 Prisma。以下定义的模型映射到 Prisma schema，关系、索引、约束均以 Prisma 语法描述。

核心设计原则：

- 使用 `cuid()` 作为主键，避免自增 ID 暴露和 UUID 性能问题
- 所有关键查询字段建立索引
- 软删除语义通过状态枚举控制，而非 `deletedAt` 字段
- 外键关系明确 `onDelete` 行为，防止级联删除意外
- SEO 相关字段内聚在 Article 模型中，避免过度归一化

## 2. 枚举类型

```prisma
enum UserRole {
  ADMIN    // 超级管理员 — 全权限
  EDITOR   // 编辑 — 管理文章/分类/标签，不可改系统设置/用户
  VISITOR  // 游客 — 只评论（可禁言）
}

enum ArticleStatus {
  DRAFT      // 草稿（仅作者/管理员可见）
  PUBLISHED  // 已发布（公开）
  ARCHIVED   // 归档（URL 保留但不出现在列表中）
}

enum CommentStatus {
  PENDING   // 待审核
  APPROVED  // 已通过
  SPAM      // 垃圾
  TRASHED   // 已删除（软删）
}
```

## 3. 核心模型

### 3.1 User

```prisma
model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  emailVerified DateTime?
  passwordHash  String?
  image         String?
  bio           String?
  role          UserRole  @default(VISITOR)
  bannedAt      DateTime?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  articles      Article[]        @relation("ArticleAuthor")
  comments      Comment[]        @relation("CommentAuthor")
  accounts      Account[]
  sessions      Session[]

  @@index([email])
  @@index([role])
  @@index([bannedAt])
}
```

说明：

- `passwordHash` 可为 null（OAuth 登录用户无需密码）
- `bannedAt` 非 null 表示该用户已被禁言
- `accounts` 和 `sessions` 由 Auth.js Prisma Adapter 管理

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
  id              String        @id @default(cuid())
  title           String
  slug            String        @unique
  excerpt         String?
  contentMarkdown String
  contentHtml     String
  coverImage      String?
  status          ArticleStatus @default(DRAFT)

  metaTitle       String?
  metaDescription String?
  metaKeywords    String?

  isPinned        Boolean       @default(false)
  publishedAt     DateTime?
  viewCount       Int           @default(0)

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  categoryId      String?
  category        Category?     @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  authorId        String
  author          User          @relation("ArticleAuthor", fields: [authorId], references: [id])

  tags            ArticleTag[]
  comments        Comment[]
  revisions       ArticleRevision[]

  @@index([slug])
  @@index([status, publishedAt])
  @@index([categoryId])
  @@index([authorId])
  @@index([isPinned, publishedAt])
}
```

设计说明：

- `contentMarkdown` 存储原文，`contentHtml` 存储编译后的 HTML，避免每次请求重复编译
- SEO 字段 (`metaTitle` / `metaDescription` / `metaKeywords`) 为可选，fallback 到文章标题和摘要
- `viewCount` 使用数据库字段，后续可改用 Redis HLL 异步更新
- `isPinned` 配合 `publishedAt` 索引，用于首页置顶查询
- `onDelete: SetNull` 在 Category 上，删除分类不会删除文章

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

### 3.6 Comment（嵌套评论）

```prisma
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

  authorId  String?
  author    User?         @relation("CommentAuthor", fields: [authorId], references: [id], onDelete: SetNull)

  guestName  String?
  guestEmail String?

  parentId   String?
  parent     Comment?     @relation("CommentReplies", fields: [parentId], references: [id], onDelete: SetNull)
  replies    Comment[]    @relation("CommentReplies")

  isSpam     Boolean      @default(false)

  @@index([articleId, status, createdAt])
  @@index([parentId])
  @@index([authorId])
  @@index([guestEmail])
}
```

嵌套设计说明：

- `parentId` 自引用，支持无限层级嵌套（实际读取时使用递归查询或在应用层构建树）
- 游客评论通过 `guestName` / `guestEmail` 标识，`authorId` 为 null
- `status` 字段控制审核状态（PENDING / APPROVED / SPAM / TRASHED）
- `isSpam` 标记用于反垃圾策略

### 3.7 Auth.js 内置表

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

这些表由 Auth.js Prisma Adapter 自动管理，不需要手写 CRUD。

## 4. 阶段扩展表（Phase 2+）

以下表不在 MVP 范围内，但已在 schema 设计中预留，后续通过 Prisma 迁移追加。

### 4.1 ArticleRevision（文章修订历史）

```prisma
model ArticleRevision {
  id              String   @id @default(cuid())
  articleId       String
  article         Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
  title           String
  contentMarkdown String
  contentHtml     String
  version         Int
  changeNote      String?
  createdAt       DateTime @default(now())

  @@index([articleId, version])
}
```

### 4.2 Media（媒体库）

```prisma
model Media {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  filename  String
  url       String
  key       String
  size      Int
  mimeType  String
  width     Int?
  height    Int?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
}
```

### 4.3 SiteSetting（站点设置）

```prisma
model SiteSetting {
  id    String @id @default(cuid())
  key   String @unique
  value String // JSON string
}
```

## 5. 索引策略总结

| 表 | 索引字段 | 用途 |
|----|----------|------|
| User | `email` | 登录查询 |
| User | `role` | 用户管理筛选 |
| User | `bannedAt` | 禁言用户筛选 |
| Category | `slug` | 前台分类页查询 |
| Tag | `slug` | 前台标签页查询 |
| Article | `slug` | 文章详情页查询 |
| Article | `status, publishedAt` | 文章列表排序筛选 |
| Article | `categoryId` | 分类下文章查询 |
| Article | `authorId` | 作者文章查询 |
| Article | `isPinned, publishedAt` | 首页置顶文章 |
| ArticleTag | `tagId` | 标签下文章查询 |
| Comment | `articleId, status, createdAt` | 文章评论筛选排序 |
| Comment | `parentId` | 嵌套回复查询 |
| Comment | `authorId` | 用户评论查询 |
| Comment | `guestEmail` | 反垃圾查询 |

## 6. 迁移与版本管理

- `prisma/schema.prisma` 是数据模型的唯一真实来源
- 所有迁移通过 `npx prisma migrate dev --name <描述>` 生成
- `prisma/migrations/` 目录必须纳入版本控制
- `prisma/seed.ts` 用于初始化管理员账户和示例数据
- Prisma Client 类型在 `prisma generate` 后自动生成，由 `node_modules/` 忽略规则覆盖
