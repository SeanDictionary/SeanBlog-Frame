# SeanBlog Frame

一个面向长期使用的个人博客 CMS 项目，用于替代 WordPress。基于 Next.js 单体全栈架构，前端、后台与 API 共享同一应用进程和类型系统。

## 技术栈

- **框架**：Next.js 16（App Router + Turbopack，standalone 输出）
- **语言**：TypeScript（strict）
- **数据库**：PostgreSQL 16 + Prisma 7
- **认证**：Auth.js v5（Credentials Provider + JWT session，单管理员模式）
- **样式**：Tailwind CSS v4
- **前台主题**：Handlebars 模板引擎 + 平台 data-* 渐进增强（详见 `docs/theme-framework.md`）
- **内容**：Markdown（unified/remark/rehype）+ Shiki 代码高亮 + KaTeX 数学公式
- **部署**：Docker / docker-compose（Next.js standalone + Postgres + 密钥初始化）

## 主要能力

- 文章（Markdown 文件存储 / 草稿 / 发布 / 归档 / 定时发布 / 置顶 / 修订历史 / ZIP 导入导出）
- 分类、标签（slug 唯一性、批量操作）
- 评论（嵌套回复、审核、黑名单规则、按文章关闭/只读）
- 媒体库（任意类型文件上传，按 MIME 分类，多选 / 粘贴 / 拖拽）
- 主题系统（运行时上传启用、设置 schema、预览、导入导出）
- 访问分析（访客 / 访问记录、每日物化统计、GeoIP、CSV 导出、交互式趋势图）
- 操作日志（含浏览器指纹 / 硬件特征，保留期可配，CSV 导出）
- SEO（`seo_head` helper 注入 title/OG/canonical/JSON-LD、`sitemap.xml`、`robots.txt`、`/rss.xml`）
- 后台概览仪表盘（统计卡片、文章热度、最近评论、趋势图）

## 快速开始

### 本地开发

```bash
npm install
npx prisma migrate dev        # 初始化本地数据库
node scripts/initialize-admin.mjs      # 创建/重置管理员账号并输出密码
node scripts/initialize-content.mjs    # 文章表为空时创建欢迎文章
npm run dev
```

需要 `.env.local`（参考字段：`DATABASE_URL`、`AUTH_SECRET`、`NEXT_PUBLIC_SITE_URL`）。

### Docker 部署

```bash
docker compose up -d --build
```

`docker-compose.yml` 会自动：生成密钥（`secrets` 服务）→ 启动 Postgres → 启动应用（`start-production.sh` 执行 `prisma migrate deploy`、初始化管理员与内容、运行 `server.js`）。默认主题 `seanblog-default` 在镜像内随包发布，首次启动会种子到 `themes` volume。

## 常用脚本

| 命令 | 作用 |
|------|------|
| `npm run dev` | 本地开发 |
| `npm run build` | 生产构建（standalone） |
| `npm run typecheck` | 类型检查 |
| `npm run db:migrate` | Prisma 迁移 |
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
- [新增需求追踪](docs/新增需求.md)

## 许可证

AGPL-3.0-only
