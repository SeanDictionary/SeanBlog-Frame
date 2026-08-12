# 后台与权限设计

## 1. 概述

系统采用 Auth.js（原 NextAuth.js）v5 作为认证方案，通过 Credentials Provider 实现唯一管理员登录，并在 Next.js App Router 内的服务端和中间件完成后台鉴权。

当前项目明确采用**单管理员模式**：系统只维护一个 `admin` 账号，不实现多用户注册、OAuth 登录、编辑协作角色或 RBAC 权限矩阵。权限判断保持二元：已登录管理员可以访问后台并执行管理操作；未登录用户只能访问公开页面。

## 2. 技术选型理由

选择 Auth.js 而非手动 JWT 实现，原因：

- 提供开箱即用的登录、session 管理、CSRF 保护
- Credentials Provider 能满足个人博客的唯一管理员登录需求
- JWT session 策略确保后台路由保护不依赖数据库 session 表
- 认证逻辑集中在 `src/lib/auth.ts`，后续如需扩展多用户也可在此处演进

当前不接入 Auth.js Prisma Adapter，原因：

- 单管理员模式不需要 OAuth 账户绑定、数据库 session 或验证码 token 表
- `User` 表只保存 `admin` 的用户名和密码哈希，模型更简单
- 管理员密码由生产初始化脚本或重置脚本生成，不开放公开注册入口

## 3. 权限模型

### 3.1 单管理员账号

| 主体 | 权限范围 |
|------|----------|
| 已登录管理员 | 管理文章、分类、标签、评论、站点设置、媒体等后台能力 |
| 未登录访客 | 浏览公开博客内容；评论能力按后续评论系统配置决定 |

核心约束：

- 数据库中只需要一个管理员账号，用户名固定为 `admin`
- 不实现 `ADMIN` / `EDITOR` / `VISITOR` 角色枚举
- 不实现用户管理页、用户禁言、文章作者归属或协作者权限
- 所有后台写操作统一调用 `requireAdmin()` 做登录校验

### 3.2 权限检查层级

1. **路由保护层**：保护 `/admin/*` 所有路径，未登录重定向到登录入口。
2. **服务端操作层**：Server Actions / Route Handlers 在执行业务逻辑前调用 `requireAdmin()`。

## 4. 后台能力矩阵

| 操作 | 已登录管理员 | 未登录访客 |
|------|--------------|------------|
| 查看后台仪表盘 | ✅ | ❌ |
| 创建/编辑/删除文章 | ✅ | ❌ |
| 发布/归档文章 | ✅ | ❌ |
| 管理分类 | ✅ | ❌ |
| 管理标签 | ✅ | ❌ |
| 审核评论 | ✅ | ❌ |
| 修改站点设置 | ✅ | ❌ |
| 上传/管理图片 | ✅ | ❌ |
| 浏览公开内容 | ✅ | ✅ |
| 发表评论 | 按评论系统配置 | 按评论系统配置 |

## 5. Auth.js 配置设计

### 5.1 配置结构

```
src/lib/
  auth.ts         # Auth.js 主配置，导出 auth() / handlers / signIn / signOut
  auth.config.ts  # 独立配置对象，使用 JWT session 策略
  auth.utils.ts   # 服务端管理员鉴权工具函数
```

### 5.2 核心配置

```typescript
// auth.config.ts
export const authConfig = {
  session: { strategy: 'jwt' },
  providers: [],
}
```

```typescript
// auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      // username 固定为 admin
      // password 与数据库中的 passwordHash 做 bcrypt 比对
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (session.user && typeof token.id === 'string') {
        session.user.id = token.id
      }
      return session
    },
  },
})
```

### 5.3 JWT session 策略

选择 JWT 而非数据库 session 的关键原因：

- 后台保护只需要知道“是否为已登录管理员”
- JWT token 可以由 Auth.js 在请求阶段解析，无需额外 session 表
- 避免为单管理员场景引入 `Account` / `Session` / `VerificationToken` 等表
- 适合个人博客场景的低复杂度 session 管理

## 6. 后台路由保护

### 6.1 Proxy / Middleware 策略

```typescript
// proxy.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export default auth((request) => {
  if (!request.auth?.user?.id) {
    const loginUrl = new URL('/api/auth/signin', request.url)
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  const response = NextResponse.next()
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
})

export const config = {
  matcher: ['/admin/:path*'],
}
```

### 6.2 服务端管理员检查

```typescript
// auth.utils.ts
import { auth } from '@/lib/auth'

export async function requireAdmin() {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  return session
}

export async function isAdminAuthenticated() {
  return Boolean((await auth())?.user?.id)
}
```

说明：

- `requireAdmin()` 在单管理员模式下只做 session 存在性检查
- 不检查 role 字段，因为数据库不维护角色
- 不实现 `requireEditor()` 或文章所有权检查

## 7. 评论审核流

评论系统属于后续阶段，默认由管理员审核：

1. **审核模式**（默认）：游客评论进入 `PENDING` 状态，管理员在后台审核后改为 `APPROVED` 或 `SPAM`
2. **开放模式**（可选）：评论可自动通过，但仍保留管理员删除和标记垃圾能力

状态流转：

```
提交评论 → PENDING
             ├── 审核通过 → APPROVED（前台显示）
             ├── 标记垃圾 → SPAM（不显示，可用于训练反垃圾规则）
             └── 删除 → TRASHED（软删除，数据库保留）
```

## 8. 后台管理页面权限

| 后台页面 | 访问要求 | 说明 |
|----------|----------|------|
| `/admin` | 已登录管理员 | 仪表盘 |
| `/admin/login` | 无需登录 | 登录页 |
| `/admin/articles` | 已登录管理员 | 文章列表 |
| `/admin/articles/new` | 已登录管理员 | 新建文章 |
| `/admin/articles/[id]/edit` | 已登录管理员 | 编辑文章 |
| `/admin/categories` | 已登录管理员 | 分类管理 |
| `/admin/tags` | 已登录管理员 | 标签管理 |
| `/admin/comments` | 已登录管理员 | 评论审核（Phase 2） |
| `/admin/logs` | 已登录管理员 | 操作日志与 CSV 导出 |
| `/admin/settings` | 已登录管理员 | 站点设置（Phase 2） |

## 9. 安全考量

- 密码使用 `bcryptjs` hash 存储，不存明文
- JWT token 使用 `AUTH_SECRET` 环境变量签名
- 管理员初始密码随机生成，只在创建或重置时输出一次
- 所有 Server Action 在执行业务逻辑前调用 `requireAdmin()`
- 生产环境强制 HTTPS，Cookie 设置 `secure: true`
- 登录和评论接口做速率限制（Phase 3 引入 Redis rate limiting）
- 游客评论记录 IP 和 User-Agent 用于反垃圾
- 关键前后台写操作写入 `OperationLog`，后台 `/admin/logs` 可按模块/结果/关键词查看并导出 CSV，便于审计与排查
