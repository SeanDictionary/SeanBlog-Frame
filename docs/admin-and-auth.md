# 后台与权限设计

## 1. 概述

系统采用 Auth.js（原 NextAuth.js）v5 作为认证方案，配合 Prisma Adapter 实现数据库用户管理，以及在 Next.js App Router 内的服务端和中间件鉴权。

权限模型采用 RBAC（Role-Based Access Control），角色为离散枚举，不做继承层级。

## 2. 技术选型理由

选择 Auth.js 而非手动 JWT 实现，原因：

- 提供开箱即用的登录、session 管理、CSRF 保护
- Prisma Adapter 与现有 PostgreSQL 基础设施无缝对接
- 支持 Credentials（用户名密码）和 OAuth 两种登录方式，扩展灵活
- JWT session 策略确保 middleware 在 Edge 运行时无需数据库连接
- 社区方案成熟，个人项目不易踩坑，简历展示也体现工程选型能力

## 3. RBAC 角色定义

三层角色，互不继承：

| 角色 | 标识 | 权限范围 |
|------|------|----------|
| 管理员 | `ADMIN` | 全部权限：管理所有文章/评论/分类/标签/用户/站点设置 |
| 编辑 | `EDITOR` | 管理文章/评论/分类/标签（只能编辑和删除自己的文章，但可查看和管理所有评论和分类标签） |
| 访客 | `VISITOR` | 无后台权限，仅前台浏览和评论（可被禁言） |

权限检查在两个层面执行：

1. **中间件层面**（`middleware.ts`）：保护 `/admin/*` 所有路径，未登录重定向 `/admin/login`
2. **服务层/Server Action 层面**：对具体操作做细粒度权限检查

## 4. 权限矩阵

| 操作 | ADMIN | EDITOR | VISITOR |
|------|-------|--------|---------|
| 查看后台仪表盘 | ✅ | ✅ | ❌ |
| 创建文章 | ✅ | ✅ | ❌ |
| 编辑/删除自己的文章 | ✅ | ✅ | ❌ |
| 编辑/删除他人的文章 | ✅ | ❌ | ❌ |
| 管理分类 | ✅ | ✅ | ❌ |
| 管理标签 | ✅ | ✅ | ❌ |
| 审核评论 | ✅ | ✅ | ❌ |
| 管理用户（角色/禁言） | ✅ | ❌ | ❌ |
| 修改站点设置 | ✅ | ❌ | ❌ |
| 上传图片 | ✅ | ✅ | ❌ |
| 前台浏览 | ✅ | ✅ | ✅ |
| 发表评论 | ✅ | ✅ | ✅ |

## 5. Auth.js 配置设计

### 5.1 配置结构

```
src/lib/
  auth.ts         # Auth.js 主配置，导出 auth() / handlers / signIn / signOut
  auth.config.ts  # 独立配置对象，供 middleware.ts 引用
  auth.utils.ts   # 服务端权限检查工具函数
```

### 5.2 核心配置

```typescript
// auth.config.ts — 供 middleware 使用
export const authConfig = {
  pages: { signIn: '/admin/login' },
  session: { strategy: 'jwt' },
  providers: [], // 在 auth.ts 中扩展
  callbacks: {
    authorized({ auth, request }) {
      const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
      if (isAdminRoute) {
        return !!auth?.user // 需要登录
      }
      return true // 前台公开访问
    },
  },
}
```

```typescript
// auth.ts — 主配置
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      // 用户名 + 密码登录
    }),
    // GitHub / Google OAuth（后续扩展）
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as UserRole
      }
      return session
    },
  },
})
```

### 5.3 JWT session 策略

选择 JWT 而非数据库 session 的关键原因：

- Next.js middleware 在 Edge Runtime 运行，无法直接访问 Prisma / PostgreSQL
- JWT token 可以在 middleware 中直接解析和校验，无需数据库 I/O
- Token 中嵌入 `role` 字段，中间件可据此做粗粒度路由保护
- 适合个人博客场景的 session 生命周期管理

## 6. 后台路由保护

### 6.1 Middleware 策略

```typescript
// middleware.ts
import { auth } from '@/lib/auth'

export default auth((req) => {
  const { pathname } = req.nextUrl

  // 登录页不需要保护
  if (pathname === '/admin/login') return

  // 所有 /admin/* 需要 session
  if (pathname.startsWith('/admin')) {
    if (!req.auth) {
      const loginUrl = new URL('/admin/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return Response.redirect(loginUrl)
    }
  }
})

export const config = {
  matcher: ['/admin/:path*'],
}
```

### 6.2 服务端权限检查

在 Server Actions 和 Server Components 中进行细粒度权限检查：

```typescript
// auth.utils.ts
import { auth } from '@/lib/auth'

export async function requireAuth() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  return session
}

export async function requireAdmin() {
  const session = await requireAuth()
  if (session.user.role !== 'ADMIN') throw new Error('Forbidden')
  return session
}

export async function requireEditor() {
  const session = await requireAuth()
  if (session.user.role !== 'ADMIN' && session.user.role !== 'EDITOR') {
    throw new Error('Forbidden')
  }
  return session
}
```

### 6.3 文章所有权检查

编辑只能操作自己的文章，管理员可操作所有文章。该检查在 `articleService` 内部实现：

- 编辑文章前：检查 `article.authorId === session.user.id || session.user.role === 'ADMIN'`
- 删除文章前：同上

## 7. 评论审核流

评论审核支持两种模式，通过 `SiteSetting` 中的 `comment_moderation` 键控制：

1. **审核模式**（默认）：游客和登录用户的评论均进入 `PENDING` 状态，管理员在后台审核后改为 `APPROVED` 或 `SPAM`
2. **开放模式**：登录用户的评论自动 `APPROVED`，游客评论仍需审核

也可选择对所有评论全部手动审核。

状态流转：

```
提交评论 → PENDING
              ├── 审核通过 → APPROVED（前台显示）
              ├── 标记垃圾 → SPAM（不显示，可用于训练反垃圾规则）
              └── 删除 → TRASHED（软删除，数据库保留）
```

## 8. 后台管理页面权限

| 后台页面 | 所需角色 | 说明 |
|----------|----------|------|
| `/admin` | ADMIN, EDITOR | 仪表盘 |
| `/admin/login` | 无需登录 | 登录页 |
| `/admin/articles` | ADMIN, EDITOR | 文章列表（EDITOR 只看到自己的） |
| `/admin/articles/new` | ADMIN, EDITOR | 新建文章 |
| `/admin/articles/[id]/edit` | ADMIN, EDITOR | 编辑文章（EDITOR 只能编辑自己的） |
| `/admin/categories` | ADMIN, EDITOR | 分类管理 |
| `/admin/tags` | ADMIN, EDITOR | 标签管理 |
| `/admin/comments` | ADMIN, EDITOR | 评论审核 |
| `/admin/users` | ADMIN | 用户管理 |
| `/admin/settings` | ADMIN | 站点设置 |

## 9. 安全考量

- 密码使用 `bcryptjs` hash 存储，不存明文
- JWT token 使用 `AUTH_SECRET` 环境变量签名
- 所有 Server Action 在执行业务逻辑前做 `requireAuth` / `requireAdmin` 检查
- 生产环境强制 HTTPS，Cookie 设置 `secure: true`
- 评论接口做速率限制（Phase 3 引入 Redis rate limiting）
- 游客评论记录 IP 和 User-Agent 用于反垃圾
