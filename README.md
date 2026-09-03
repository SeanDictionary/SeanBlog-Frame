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

只需一个 [`docker-compose.yml`](https://github.com/SeanDictionary/SeanBlog-Frame/blob/main/docker-compose.yml) 文件即可部署，镜像由 CI 在打 `v*.*.*` 标签时自动构建并发布到 GHCR（多架构 `amd64` / `arm64`）：

```
ghcr.io/seandictionary/seanblog-frame:latest
```

### 一键部署（推荐）

部署机只要有 Docker，执行官方安装脚本即可（自动下载 compose、拉镜像、启动、等待就绪、并把首次管理员密码打印到终端）

脚本完成后会直接输出管理员账号/密码和后台地址。打开 `http://<服务器IP>:3000/admin` 登录，到「站点信息」设置项填写真实域名（如 `https://blog.example.com`），保存后即时生效，无需重建镜像。

默认暴露宿主机 `3000` 端口。需改用别的端口时，用环境变量 `APP_PORT` 指定（容器内端口固定 3000，仅改对外映射）：

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/SeanDictionary/SeanBlog-Frame/main/install.sh)"
APP_PORT=8080 bash -c "$(curl -fsSL https://raw.githubusercontent.com/SeanDictionary/SeanBlog-Frame/main/install.sh)"
```

也可在部署目录放 `.env` 持久化（compose 自动读取）：

```env
APP_PORT=8080
```

### 手动部署

不想用脚本时，拿 compose 文件直接启动：

```bash
curl -O https://raw.githubusercontent.com/SeanDictionary/SeanBlog-Frame/main/docker-compose.yml
docker compose up -d        # 首次会拉取镜像、生成密钥、建表、初始化管理员/欢迎文章
# 首次管理员密码在 app 容器日志：docker compose logs app | grep -A3 'Administrator password'
```

### 升级

重跑安装脚本即可升级（自动拉取最新镜像并重启）：

```bash
bash install.sh
# 或手动：docker compose pull && docker compose up -d   # migrate deploy 自动应用新迁移
```

命名卷保留所有数据，重建容器不丢失（数据库、文章、主题、密钥、后台设置）。**生产库切勿 `migrate reset`。**

### 从源码构建（可选）

自行改了代码或离线场景，加 `--build` 即从本地源码构建（compose 同时声明了 `image` 与 `build`，由命令决定拉镜像还是本地构建）：

```bash
# 需要完整源码
git clone https://github.com/SeanDictionary/SeanBlog-Frame.git
cd SeanBlog-Frame
docker compose up -d --build
```

### 启动后自动完成

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

使用 `install.sh` 部署时，脚本会在启动就绪后**直接把首次管理员密码打印到终端**，无需手动查日志。

手动部署或脚本未抓到时，从 app 容器日志获取：

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
- [主题开发指引](docs/theme-development.md)
- [OpenAPI 规范](docs/openapi.json)

## 许可证

AGPL-3.0-only
