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

enum ArticleCommentsMode {
  ENABLED     // 允许评论
  READ_ONLY   // 只读（展示已有评论，禁止新评论）
  DISABLED    // 关闭评论
}
```

说明：

- 不定义 `UserRole`，因为后台只有唯一管理员
- `ArticleCommentsMode` 控制单篇文章评论区状态，覆盖站点级评论开关；默认 `ENABLED`
- 评论状态枚举见下文 `CommentStatus`

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
  status                ArticleStatus       @default(DRAFT)
  commentsMode          ArticleCommentsMode @default(ENABLED)

  metaTitle             String?
  metaDescription       String?
  metaKeywords          String?

  isPinned              Boolean       @default(false)
  publishedAt           DateTime?
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
  visitorId  String?

  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  articleId String
  article   Article       @relation(fields: [articleId], references: [id], onDelete: Cascade)

  guestName  String?
  guestEmail String?
  guestLink  String?

  parentId   String?
  parent     Comment?     @relation("CommentReplies", fields: [parentId], references: [id], onDelete: SetNull)
  replies    Comment[]    @relation("CommentReplies")
  visitor   Visitor?     @relation(fields: [visitorId], references: [visitorId], onDelete: SetNull)

  isSpam     Boolean      @default(false)

  @@index([articleId, status, createdAt])
  @@index([parentId])
  @@index([guestEmail])
  @@index([visitorId])
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
- 支持任意类型文件上传（图片、视频、音频、文档、压缩包等），单文件上限 50 MB
- 上传文件按 MIME 类型分类写入 `public/uploads/media/{category}/`（`category` ∈ images / videos / audio / documents / archives / other，由 `src/lib/media-category.ts` 统一分类），`key` 形如 `uploads/media/{category}/{filename}`
- 文件名保留原文件名（清洗非法字符），冲突时自动追加序号；原文件名无扩展名时按 MIME 兜底补全
- 上传入口支持多选、复制粘贴与拖拽到页面三种方式
- 媒体库删除记录时会同步删除对应本地文件；批量删除同样清理本地文件
- 媒体库支持按分类筛选（全部 / 图片 / 视频 / 音频 / 文档 / 压缩包 / 其他），并展示分类图标与标签
- `width` / `height` 仅图片场景预留，当前未做尺寸探测，默认为 null

### 4.4 SiteSetting（站点设置）

```prisma
model SiteSetting {
  id    String @id @default(cuid())
  key   String @unique
  value String // JSON string
}
```

### 4.4b ThemeCustomization（主题自定义设置）

```prisma
model ThemeCustomization {
  themeSlug String   @unique
  settings  Json
  settingsVersion Int @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- `themeSlug` 对应主题包的 slug，每个主题独立保存一份站点级配置。
- `settings` 保存数据库中的原始自定义值；读取主题时再与当前 `theme.yaml.settingsSchema` 的默认值合并。
- 主题导出中的 `theme-settings.json` 不直接复制此 JSON，而是按当前 schema 生成全量有效设置快照，因此未显式保存但当前实际生效的默认值也会被包含。
- 删除主题包时同步删除对应记录；默认主题和当前启用主题不可删除。
- `ThemeCustomization.settingsVersion` 记录当前数据库设置对应的主题 schema 版本；旧记录缺少该字段时按 v1 处理，主题升级后运行时自动迁移并回写。
- 导出快照额外携带 `formatVersion`、主题 `settingsVersion` 和 `settingsSchemaHash`，用于跨环境导入导出校验。

### 4.5 AnalyticsEvent（访问统计事件）

```prisma
model AnalyticsEvent {
  id                 String   @id @default(cuid())
  path               String
  contentType        String
  articleId          String?
  categoryId         String?
  tagId              String?
  visitorId          String?
  referrer           String?
  country            String?      # 访问者国家/地区名称，由 IP 经 ipinfo.io lite 接口查得（需在后台设置 ipinfoToken，未设置则不查询、留空）
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
  @@index([visitorId])
}
```

说明：

- 统计事件记录访问路径、内容类型、关联文章/分类/标签、访问地区和访问时长；事件明细永久保存，不做硬删除
- `country` 由访问 IP 通过 ipinfo.io lite 接口查询（不依赖平台 geo 请求头）；需在后台“访问统计与隐私”设置 ipinfoToken，未设置 token 时不调用接口、地区留空
- `visitorId` 直接使用客户端生成的随机 UUID（localStorage），与 Visitor 表关联，用于访客去重
- `ipAddress`、`userAgent` 由操作日志始终采集（不受分析隐私开关控制，用于管理审计）；`browserFingerprint`、`hardware` 由 `AdminIdentityBootstrap` 在后台通过 cookies（`sb-fp`/`sb-hw`）采集
- `browserFingerprint` 与 `hardware` 均为客户端生成的明文 JSON，按"显示环境"与"硬件算力"分栏：`browserFingerprint` = `{ language, timezone, screenWidth, screenHeight, devicePixelRatio }`（屏幕宽高只在指纹中保留一份）；`hardware` = `{ cores, memory, gpu }`，其中 `gpu` 由 WebGL（`WEBGL_debug_renderer_info` 的 UNMASKED_RENDERER，回退标准 RENDERER）取得 renderer 后经 `normalizeGpu` 清洗为显卡型号（剥 `ANGLE(...)` 外壳、去后端后缀与 PCI ID），清洗失败时保留原始 renderer；隐私模式或无 WebGL 时留空
- `referrer` 等隐私字段默认不采集，仅在后台设置中显式开启后写入
- 文章 `viewCount` / `visitorCount` 由前台访问埋点脚本写入事件时回写，避免页面元数据渲染和详情渲染重复增加浏览量
- 前台埋点由 `public/analytics.js`（vanilla，零依赖）实现，经 `render-service.ts` 的 `platform_enhance` 注入到所有公开主题页（与 `enhance.js` 一同加载）；身份生成与 `src/lib/client/identity.ts` 共用 localStorage key 与 fingerprint/hardware JSON 格式，保证评论与访问共享同一 visitorId
- 后台统计页包含“总览”和“访问记录”子页：总览按天/周/月展示趋势、Top 文章、最近访问、分段访问量、来源地区和系统统计；访问记录按访问记录分页展示并支持 CSV 导出
- 默认统计范围为 180 天（硬编码常量 `DEFAULT_ANALYTICS_RANGE_DAYS`），事件明细永久保存，不做保留清理

### 4.5b Visitor（访客注册表）访客注册表，每个唯一 visitorId 一行，用于快速计数访客数和判断新老访客。```model Visitor {  visitorId       String   @id  firstSeenAt     DateTime @default(now())  lastSeenAt      DateTime @default(now())  visitCount      Int      @default(1)  analyticsEvents AnalyticsEvent[]  comments        Comment[]  @@index([lastSeenAt])  @@index([firstSeenAt])}```- `visitorId` 是客户端 localStorage 生成的随机 UUID，直接做主键- `firstSeenAt` / `lastSeenAt` 用于判定区间内是否有该访客（lastSeenAt ≥ T ⟺ 在 [T,now] 有访问）### 4.5c AnalyticsDailyStat（每日访问量物化）每日按维度的访问量聚合表，用于快速计算区间访问量、趋势和 Top 内容，避免全量扫描事件表。```enum AnalyticsDimension { all article category tag }model AnalyticsDailyStat {  date       DateTime  dimension  AnalyticsDimension  contentId  String  views      Int      @default(0)  @@id([date, dimension, contentId])  @@index([dimension, date])  @@index([contentId, date])}```- `contentId` 为 article/category/tag 的 id，`dimension=all` 时为空串- 复合主键确保每天每维度每内容一行
### 4.6 OperationLog（操作日志）

```prisma
model OperationLog {
  id           String             @id @default(cuid())
  actorId      String?
  actorName    String?
  actorType    String
  module       String
  action       String
  targetType   String?
  targetId     String?
  summary      String
  result       OperationLogResult
  errorCode    String?
  errorMessage String?
  metadata     Json?
  ipAddress    String?
  userAgent    String?
  browserFingerprint String?
  hardware          String?
  method       String?
  path         String?
  createdAt    DateTime           @default(now())
}
```

说明：

- 操作日志记录后台新增、编辑、删除、批量处理、导入导出、主题安装/删除、设置保存，以及前台评论提交等关键写操作；访问统计成功事件不再写入操作日志，仅统计写入失败时记录一条最小化失败日志
- 日志保存操作时间、操作人、模块、动作、对象、摘要、成功/失败结果、错误代码、错误信息、请求路径、IP、User-Agent 和结构化 metadata；访客与统计相关日志默认不记录 IP、User-Agent、请求路径，避免绕过统计隐私开关；请求路径只记录 pathname，不包含 query
- metadata 在写入前做敏感 key 脱敏和体积截断，错误信息做长度限制和数据库错误标准化，避免泄露密钥、内部细节或环境信息
- 后台 `/admin/logs` 支持按关键词、模块、结果筛选，并通过 `/api/admin/logs/export` 导出 CSV；CSV 分批导出、带 UTF-8 BOM 并做公式注入防护
- `operationLogRetentionDays` 站点设置控制操作日志保留期，默认 365 天；通过 `npm run logs:prune` 运行清理脚本删除过期日志，建议由外部定时任务每日执行

## 5. 索引策略总结

| 表 | 索引字段 | 用途 |
|----|----------|------|
| User | `username` | 管理员登录查询 |
| Category | `slug` | 前台分类页查询 |
| Tag | `slug` | 前台标签页查询 |
| Article | `slug` | 文章详情页查询 |
| Article | `status, publishedAt` | 文章列表排序筛选与定时发布过滤 |
| Article | `categoryId` | 分类下文章查询 |
| Article | `isPinned, publishedAt` | 首页置顶文章 |
| ArticleTag | `tagId` | 标签下文章查询 |
| Comment | `articleId, status, createdAt` | 文章评论筛选排序 |
| Comment | `parentId` | 嵌套回复查询 |
| Comment | `guestEmail` | 反垃圾查询 |
| ArticleRevision | `articleId, version` | 文章版本历史查询 |
| Media | `createdAt` | 媒体库时间排序 |
| OperationLog | `createdAt` | 操作日志倒序展示与导出 |
| OperationLog | `result, createdAt` | 按成功/失败筛选日志 |
| OperationLog | `module, createdAt` | 按功能模块筛选日志 |
| OperationLog | `actorType, createdAt` | 区分管理员、访客、系统操作 |
| OperationLog | `targetType, targetId` | 追踪具体操作对象 |

## 6. 迁移与版本管理

- `prisma/schema.prisma` 是数据模型的唯一真实来源
- 当前项目处于预发布开发阶段，`prisma/migrations/20260809020000_init` 是包含全部当前结构的单一基线迁移；结构调整后可重置本地开发数据库并重新生成该基线，而不保留兼容性迁移链
- `prisma/migrations/` 目录必须纳入版本控制
- 本地重建数据库使用 `npx prisma migrate reset`；生产或已承载真实数据的环境不得采用该命令
- 管理员账号通过 `scripts/initialize-admin.mjs` 在生产启动时确保存在，不再维护 Prisma seed 脚本
- 生产首次部署时，`scripts/initialize-content.mjs` 会在文章表为空时创建一篇欢迎文章；已有文章时不会重复创建或覆盖内容
- Prisma Client 类型在 `prisma generate` 后自动生成，由 `node_modules/` 忽略规则覆盖
- `settingsVersion`：数据库设置当前对应的 schema 版本；旧记录缺少该字段时按 v1 迁移，主题升级后运行时自动迁移并回写。
- `theme-settings.json` 的 `formatVersion`、主题 `settingsVersion` 和 `settingsSchemaHash`：用于跨环境导入导出校验。
