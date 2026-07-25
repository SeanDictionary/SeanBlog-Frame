# 后端接口约定

本文档记录当前后端 Route Handlers 的接口面。项目采用单管理员模式：公开接口无需登录，`/api/admin/*` 接口必须存在有效管理员 session。

## 工具导入

可将 [openapi.json](openapi.json) 导入 Postman 或 Apifox，用于生成接口集合和请求示例。

- Postman：`Import` → 选择 `docs/openapi.json`
- Apifox：`导入项目` / `导入数据` → 选择 OpenAPI / Swagger → 选择 `docs/openapi.json`
- 本地默认服务地址：`http://localhost:3000`
- 管理员接口使用 Auth.js session cookie；本地通常为 `authjs.session-token`，HTTPS 生产环境可能为 `__Secure-authjs.session-token`。请先通过 `/api/auth/signin` 登录，再测试 `/api/admin/*`

## 通用约定

- 成功响应统一返回 JSON，删除成功返回 `204 No Content`。
- 失败响应格式：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "issues": []
  }
}
```

- 常见错误码：`VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_SERVER_ERROR`。
- 列表接口分页参数：`page` 默认 `1`，`pageSize` 默认 `20`，最大 `100`。

## 认证接口

认证接口由 Auth.js catch-all Route Handler 提供，实际文件为 `src/app/api/auth/[...nextauth]/route.ts`。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/auth/signin` | Auth.js 登录页 / 登录入口 |
| `GET` | `/api/auth/providers` | 读取可用认证 provider |
| `GET` | `/api/auth/session` | 读取当前 session |
| `GET` | `/api/auth/csrf` | 获取 CSRF token |
| `GET` | `/api/auth/error` | Auth.js 错误页 / 错误入口 |
| `POST` | `/api/auth/signout` | 登出 |
| `POST` | `/api/auth/callback/credentials` | Credentials 登录回调，提交 `username=admin` 与 `password` |

说明：

- 管理员接口使用 Auth.js session cookie；本地通常为 `authjs.session-token`，HTTPS 生产环境可能为 `__Secure-authjs.session-token`。
- 请先通过 `/api/auth/signin` 或 `/api/auth/callback/credentials` 登录，再测试 `/api/admin/*`。
- Auth.js 还会按需提供内部回调路径；这些路径由 Auth.js 管理，不在业务服务层中手写。

## 公开接口

### 文章

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/articles` | 已发布文章列表，支持 `page`, `pageSize`, `category`, `tag` |
| `GET` | `/api/articles/:slug` | 已发布文章详情，包含分类、标签和已审核评论 |
| `GET` | `/api/search?q=keyword` | 已发布文章搜索，支持 `page`, `pageSize` |

### 分类与标签

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/categories` | 分类列表，包含文章数量 |
| `GET` | `/api/categories/:slug` | 分类详情 |
| `GET` | `/api/tags` | 标签列表，包含文章数量 |
| `GET` | `/api/tags/:slug` | 标签详情 |

### 评论

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/comments` | 游客提交评论，默认进入待审核状态 |

评论请求体：

```json
{
  "articleId": "article-id",
  "content": "评论内容",
  "guestName": "访客昵称",
  "guestEmail": "name@example.com",
  "parentId": "optional-parent-comment-id"
}
```

### 内容分发

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/rss.xml` | RSS 2.0 feed，取最近 50 篇已发布文章 |
| `GET` | `/sitemap.xml` | 动态 sitemap |
| `GET` | `/robots.txt` | robots 配置，禁止 `/admin/` |
| `GET` | `/api/health` | 存活检查 |

## 管理员接口

### 文章管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/articles` | 后台文章列表，支持 `page`, `pageSize`, `status`, `category`, `tag`, `q` |
| `POST` | `/api/admin/articles` | 创建文章 |
| `GET` | `/api/admin/articles/:id` | 后台文章详情，包含修订历史 |
| `PATCH` | `/api/admin/articles/:id` | 更新文章 |
| `DELETE` | `/api/admin/articles/:id` | 删除文章 |
| `POST` | `/api/admin/articles/:id/publish` | 发布文章 |
| `POST` | `/api/admin/articles/:id/archive` | 归档文章 |

文章创建/更新字段：

```json
{
  "title": "文章标题",
  "slug": "optional-custom-slug",
  "excerpt": "摘要",
  "contentMarkdown": "# Markdown",
  "contentHtml": "可选 HTML，未传则服务端编译",
  "coverImage": "/uploads/cover.webp",
  "status": "DRAFT",
  "metaTitle": "SEO 标题",
  "metaDescription": "SEO 描述",
  "metaKeywords": "keyword1,keyword2",
  "isPinned": false,
  "categoryId": "category-id",
  "tagIds": ["tag-id"],
  "publishedAt": "2026-07-23T00:00:00.000Z",
  "changeNote": "修改说明"
}
```

### 分类与标签管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/categories` | 分类列表 |
| `POST` | `/api/admin/categories` | 创建分类 |
| `PATCH` | `/api/admin/categories/:id` | 更新分类 |
| `DELETE` | `/api/admin/categories/:id` | 删除分类 |
| `GET` | `/api/admin/tags` | 标签列表 |
| `POST` | `/api/admin/tags` | 创建标签 |
| `PATCH` | `/api/admin/tags/:id` | 更新标签 |
| `DELETE` | `/api/admin/tags/:id` | 删除标签 |

分类请求体：

```json
{
  "name": "Engineering",
  "slug": "engineering",
  "description": "分类描述",
  "sortOrder": 1
}
```

标签请求体：

```json
{
  "name": "Next.js",
  "slug": "nextjs"
}
```

### 评论审核

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/comments` | 评论列表，支持 `page`, `pageSize`, `status`, `articleId` |
| `PATCH` | `/api/admin/comments/:id` | 更新评论状态 |
| `DELETE` | `/api/admin/comments/:id` | 软删除评论，状态改为 `TRASHED` |

评论审核请求体：

```json
{
  "status": "APPROVED",
  "isSpam": false
}
```

### 媒体与设置

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/media` | 媒体列表 |
| `POST` | `/api/admin/media` | 登记媒体元数据 |
| `DELETE` | `/api/admin/media/:id` | 删除媒体记录 |
| `GET` | `/api/admin/settings` | 站点设置列表 |
| `GET` | `/api/admin/settings/:key` | 读取单个设置 |
| `PUT` | `/api/admin/settings/:key` | 创建或更新设置 |

媒体请求体：

```json
{
  "filename": "cover.webp",
  "url": "/uploads/cover.webp",
  "key": "uploads/cover.webp",
  "size": 1024,
  "mimeType": "image/webp",
  "width": 1200,
  "height": 630
}
```

设置请求体：

```json
{
  "value": "SeanBlog Frame"
}
```
