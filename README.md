# SeanBlog Frame

一个面向长期使用的个人博客 CMS，用于替代 WordPress。基于 Next.js 单体全栈架构，前端、后台与 API 共享同一应用进程和类型系统。

## 技术栈

- **框架**：Next.js 16（App Router + Turbopack，`output: 'standalone'`）
- **语言**：TypeScript（strict）
- **数据库**：PostgreSQL 16 + Prisma 7
- **认证**：Auth.js v5（Credentials Provider + JWT session，单管理员模式）
- **样式**：Tailwind CSS v4
- **前台主题**：Handlebars 模板引擎 + 平台 data-* 渐进增强（见 `docs/theme-framework.md`）
- **内容**：Markdown（unified/remark/rehype）+ Shiki 代码高亮 + KaTeX 数学公式
- **部署**：Docker / docker-compose（Next.js standalone + Postgres + 密钥初始化）

## 主要能力

- 文章（Markdown 文件存储 / 草稿 / 发布 / 归档 / 定时发布 / 置顶 / 修订历史 / ZIP 导入导出 / 文章与页面区分）
- 分类、标签（slug 唯一性、批量操作）
- 评论（嵌套回复、审核、黑名单规则、按文章关闭/只读）
- 媒体库（任意类型文件上传，按 MIME 分类，多选 / 粘贴 / 拖拽）
- 主题系统（运行时上传启用、设置 schema、预览、导入导出）
- 访问分析（访客 / 访问记录、每日物化统计、GeoIP、CSV 导出、交互式趋势图）
- 操作日志（含浏览器指纹 / 硬件特征，保留期可配，CSV 导出）
- SEO（`seo_head` 注入 title/OG/canonical/JSON-LD、`sitemap.xml`、`robots.txt`、`/rss.xml`）
- 后台概览仪表盘（统计卡片、文章热度、最近评论、趋势图）

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接串，如 `postgresql://postgres:pwd@host:5432/seanblog_frame?schema=public` |
| `AUTH_SECRET` | 是 | Auth.js JWT 签名密钥，用 `openssl rand -base64 32` 生成 |
| `TRUST_PROXY_HEADERS` | 看部署 | `true` 时信任 `X-Forwarded-For`（反向代理后必须为 `true` 才能正确限流与采集访客 IP）；直连暴露时设 `false` |
| `SECRETS_DIRECTORY` | Docker 用 | 密钥文件目录，默认 `/run/secrets`，由 compose `secrets` 服务生成 |

> 站点 URL（`siteUrl`）不再使用环境变量，改为后台「站点信息」设置项运行时读取，缺省 `http://localhost:3000`。生产部署后在 `/admin` 设置真实域名即可，无需重建镜像。

## 本地开发

1. 准备 `.env.local`（仓库根，不纳入版本控制）：

   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/seanblog_frame?schema=public
   AUTH_SECRET=用 openssl rand -base64 32 生成
   ```

   > 站点 URL 在后台「站点信息」设置项配置，无需 `.env.local`。

2. 初始化数据库与管理员：

   ```bash
   npm install
   npx prisma migrate dev          # 应用基线迁移（首次建表）
   node scripts/initialize-admin.mjs      # 创建管理员并输出密码（仅首次）
   node scripts/initialize-content.mjs    # 文章表为空时创建欢迎文章
   npm run dev
   ```

打开 `http://localhost:3000`，后台在 `/admin`，用输出的管理员密码登录。

## Docker 部署（推荐）

提供两份 compose：

- `docker-compose.prod.yml` —— **推荐**，直接拉取 GHCR 发布镜像，部署机无需源码 / 无需本地构建
- `docker-compose.yml` —— 从源码构建，适合自行修改后部署或离线场景

### 方式一：使用发布镜像（推荐，免构建）

镜像由 CI（`.github/workflows/docker-publish.yml`）自动构建并发布到 GHCR，多架构支持 `amd64` / `arm64`：

```
ghcr.io/seandictionary/seanblog-frame:latest
```

部署机只要有 Docker：

```bash
# 只需 compose 文件即可（镜像自动拉取）
docker compose -f docker-compose.prod.yml up -d
```

升级：

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

命名卷保留所有数据，重建容器不丢失（数据库、文章、主题、密钥、后台设置）。

> 提示：导出 `COMPOSE_FILE=docker-compose.prod.yml` 后，下方所有 `docker compose ...` 命令可直接使用，无需每次加 `-f`。

### 方式二：从源码构建

```bash
docker compose up -d --build
```

启动后到 `/admin` 的「站点信息」设置项填写真实域名（如 `https://blog.example.com`），保存后即时生效，无需重建镜像。

两份 compose 均会自动完成：

1. `secrets` 服务生成 `auth_secret` / `postgres_password` 写入命名卷
2. `db`（Postgres 16）启动并健康检查
3. `app` 启动，入口脚本 `scripts/start-production.sh` 依次执行：
   - 从密钥卷读取密码并 export `AUTH_SECRET` / `DATABASE_URL`
   - `prisma migrate deploy`（应用迁移，首启建表）
   - `initialize-admin.mjs`（管理员不存在则创建）
   - `initialize-content.mjs`（文章表为空则创建欢迎文章）
   - `exec node server.js`（Next.js standalone）

默认主题 `seanblog-default` 随镜像发布，首次启动种子到 `themes` 命名卷。

### 获取管理员密码

首次 `app` 启动时 `initialize-admin` 会把密码打印到 **app 容器标准输出**：

```bash
docker compose logs app | grep -A3 "Administrator password"
```

仅首次创建时输出，后续启动不再打印（管理员已存在）。重置密码：

```bash
docker compose exec app node scripts/reset-admin-password.mjs
```

### 配置与反向代理

- 站点 URL 由后台「站点信息」设置项运行时读取（带短缓存），修改域名后保存即可生效，无需 `--build`。
- compose 默认 `TRUST_PROXY_HEADERS: "true"`，适配"容器在反代后"的典型拓扑。若直接暴露 3000 端口到公网（不推荐），改 `"false"` 以防 `X-Forwarded-For` 被客户端伪造。
- 反向代理（Caddy / Nginx）需将 `X-Forwarded-For`、`X-Forwarded-Proto` 透传，并终止 HTTPS。Caddy 示例：

  ```caddyfile
  blog.example.com {
    reverse_proxy localhost:3000
  }
  ```

### 数据持久化与备份

命名卷：`seanblog_pgdata`（数据库）、`seanblog_secrets`（密钥）、`seanblog_content`（文章 Markdown）、`seanblog_themes`（主题包）。

```bash
# 备份数据库
docker compose exec db pg_dump -U postgres seanblog_frame > backup-$(date +%F).sql

# 恢复
cat backup.sql | docker compose exec -T db psql -U postgres seanblog_frame

# 备份内容与主题
docker run --rm -v seanblog_content:/c -v "$PWD":/b alpine tar czf /b/content-$(date +%F).tgz -C /c .
```

### 运维

```bash
docker compose logs -f app            # 实时日志
docker compose restart app            # 重启应用（不动数据库）
docker compose ps                      # 查看健康状态（app 有 /api/health 探活）
```

操作日志保留期可在后台设置（默认 365 天），定期清理（建议外部 cron 每日）：

```bash
docker compose exec app node scripts/prune-operation-logs.mjs
```

### 升级

镜像发布方式（推荐）：

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d   # migrate deploy 自动应用新迁移
```

源码构建方式：

```bash
git pull
docker compose up -d --build          # 重新构建并重启，migrate deploy 自动应用新迁移
```
```

> 首次正式上线后，迁移为**增量工作流**（每次结构变更一条迁移），`prisma migrate deploy` 自动按序应用。**生产库切勿 `migrate reset`**（会清空数据）。

## 从源码部署（无 Docker）

```bash
npm ci
npx prisma generate
npm run build                         # 输出 .next/standalone
export DATABASE_URL=... AUTH_SECRET=...
node .next/standalone/server.js       # 监听 :3000
```

站点 URL 在后台「站点信息」设置项配置，缺省 `http://localhost:3000`。

需自行管理 Postgres、密钥、`content/` 与 `themes/` 目录的持久化。

## 常用脚本

| 命令 | 作用 |
|------|------|
| `npm run dev` | 本地开发 |
| `npm run build` | 生产构建（standalone） |
| `npm run typecheck` | 类型检查 |
| `npm run db:migrate` | Prisma 迁移（开发） |
| `npm run db:studio` | Prisma Studio 可视化数据 |
| `npm run admin:reset-password` | 重置管理员密码 |
| `npm run logs:prune` | 清理过期操作日志 |
| `node scripts/build-openapi.mjs` | 由实际路由重建 `docs/openapi.json` |

## 文档索引

- [PRD - 产品需求](docs/prd.md)
- [系统架构设计](docs/architecture.md)
- [数据模型与数据库设计](docs/data-model.md)
- [后台与权限设计](docs/admin-and-auth.md)
- [SEO 与内容系统设计](docs/seo-and-content.md)
- [主题框架设计](docs/theme-framework.md)
- [OpenAPI 规范](docs/openapi.json)

## 许可证

AGPL-3.0-only
