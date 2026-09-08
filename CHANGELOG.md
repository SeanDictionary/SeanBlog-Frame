# Changelog

本文件记录 SeanBlog Frame 的显著变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

发布流程：发版时把 `## [Unreleased]` 移至新的 `## [版本号]` 段 → 更新 `package.json` 的 `version` → 打 `v*.*.*` 标签 → push 触发 CI，CI 从本文件提取对应版本段落作为 GitHub Release 正文。
新增变更时先写在 `## [Unreleased]` 下。

> 主题仓库（SeanBlog-Themes）的发版约定不同：不打 tag，常规改动仅本地提交，仅正式发版时 bump `theme.yaml` version + CHANGELOG 版本段后 push。详见 `AGENTS.md`。

## [Unreleased]

### Added

- 主题包支持「就地更新」：上传安装时新增 `mode` 字段（`install` 默认 / `update`）。`update` 模式下 slug 已存在时先备份旧目录再覆盖写入，写入失败回滚到备份，**不删除 `ThemeCustomization` 数据库行**，用户自定义设置自然保留；可直接更新当前活跃主题（无需先切走）。若新版本号低于旧版本号，响应携带降级提示警告。后台「主题」页每张已安装主题卡新增「更新」按钮，复用导入确认弹窗并按 `mode=update` 提交。
- 新增站点设置 `siteIcon`（站点图标 URL / favicon）：后台「设置 → 站点信息」新增字段，保存后注入到前台主题渲染 `<head>` 的 `<link rel="icon">`（经 `enrichCtx` 追加到 `seo_head`，主题无需改动）与后台 root layout head；`ctx.site.icon` 供主题模板消费。
- 新增 `GET /api/admin/version` 接口：读取当前 `package.json` 版本，拉取 GitHub `SeanDictionary/SeanBlog-Frame` 的 latest release tag 做 semver 比较，带 5 分钟内存缓存。
- 后台侧边栏「SeanBlog Admin」下方新增小字版本行（当前版本号），点击触发版本检查；存在新版本时以绿色跟随显示新版本号，检查失败显示提示。

### Changed

- 后台「主题」页设置读取统一走 `getThemeSettings`（与公开渲染同一条缓存路径），不再直接拼 `dbRow + schema 默认值`，消除 `settingsVersion` 未迁移前后台与前台显示不一致的窗口。
- `ThemesManager` 客户端 state 同步：活跃主题切换或 `themeSettings` prop 变化（如就地更新后服务端返回新值）时重建 `liveValues` / `themeSettingsState`，避免表单与 Callout CSS 显示旧主题/旧值。
- 保存主题设置时对「合并后的整体」跑一次 `validateThemeSettingsValues`，schema 收紧（如删除某 select 选项）时能及时发现库里残留旧值。
- 主题包导出显式排除磁盘上可能残留的 `theme-settings.json`，避免陈旧快照被打进发布包；`includeSettings=true` 时改用新鲜快照。
- 导入失败回滚区分 `install`/`update`：`install` 模式设置应用失败仍删整包回滚；`update` 模式不删已更新的文件（避免丢掉旧版）。

### Fixed

- 修复更新主题需「先卸载再上传」、卸载又禁止删除活跃主题导致的 4 步流程与设置丢失问题。
- 修复前台分类/标签页 404 误报 500：`publicErrorResponse` 现识别 `ApiError.status`，404 统一走主题 `404.hbs`（回退内置静态 404），其他业务错误码透传其 status。此前 `/tags/<不存在>`、`/categories/<不存在>` 因 `classifyError` 仅判数据库错误、忽略 `ApiError.status` 而返回 500；文章详情路由靠手写兜底才正确，现已清理该重复兜底。

### Removed

- 移除主题「主页预览 / 文章预览」功能（`/theme-preview` 路由、后台卡片上的两个预览入口、`docs` 预览小节及相关说明）。预览页本是平台内置的简化 React 骨架，无法真实反映主题 Handlebars 模板与模板级自定义设置（如 cardinal 的 `showTopBar`、`heroWidth`、`sidebarPosition` 等），易误导上线判断；直接移除该功能，主题效果以真实前台为准。后台「主题」页每张主题卡按钮随之重排为单行：启用 / 更新 / 导出 / 卸载（默认主题仅启用）。

### Upgrade Notes

从 0.5.0 升级到本版本需要手动执行以下步骤：

1. **数据库迁移**：容器启动时自动执行 `prisma migrate deploy`，新增 `contentHtml` 和 `searchText` 列。

2. **回填现有文章**（可选但推荐）：
   ```bash
   docker exec -it seanblog-app sh
   cd /app
   node scripts/backfill-article-content.mjs
   exit
   ```
   - `contentHtml`：不回填不影响功能（NULL 时回退实时渲染），但性能差（每请求 ~800ms Shiki 渲染）
   - `searchText`：**必须回填**，否则搜索功能失效（新搜索逻辑用 `ILIKE` 查此列，NULL 搜不到）
   - 脚本幂等，可重复执行，跳过已回填的文章

3. **更新 cardinal 主题**（从 Themes 仓库同步）：
   ```bash
   # 方式 A：手动复制文件
   docker cp cardinal/partials/header.hbs seanblog-app:/app/themes/cardinal/partials/
   docker cp cardinal/assets/theme.css seanblog-app:/app/themes/cardinal/assets/
   docker cp cardinal/assets/js/main.js seanblog-app:/app/themes/cardinal/assets/
   
   # 方式 B：rsync 同步（推荐）
   rsync -av --delete /path/to/SeanBlog-Themes/cardinal/ /path/to/seanblog_themes/cardinal/
   ```
   然后重启容器：`docker compose restart app`

4. **缓存失效**：ISR 缓存 5 分钟，发布后最多等 5 分钟所有页面自动刷新。或手动触发：
   ```bash
   curl http://localhost:3000/
   ```
## [0.5.0] - 2026-09-06

### Added

- 后台「文章」列表支持分页浏览、每页条数选择（20/50/100，默认 20）。分页导航与每页选择器样式对齐访问记录页（`/admin/visits`：`min-w-8` 圆角 pill + 省略号 + `每页 [select] 条`），置于文章表格卡片底部。页码与每页条数均为 URL 驱动（`page` / `pageSize` 查询参数），与现有搜索、状态/分类/标签过滤、排序参数协同：翻页保留全部过滤态，搜索/排序/切页数时自动回到第 1 页。修复此前 76 篇文章只展示前 20 条、无法翻页的问题。
- 统计总览页「最近访问记录」由最新 10 条增至 20 条。
- 全站 404 分层化：前台未匹配路径与不存在的文章 slug 统一返回 404 页。主题可在 `templates/404.hbs` 提供自定义 404（套 `default` 布局，ctx 含 `page:'404'`、站点/主题/侧边栏基础数据、`robots: noindex` 的 seo）；未提供时回退到平台内置 404 静态页（与 500/503 错误页同款样式，带「返回首页 / 返回上一页」按钮）。后台 `/admin/**` 未匹配路径走独立 `admin/not-found.tsx`（在 admin layout 内、需登录，带「返回后台首页」）。`/api/**` 未匹配路径返回 JSON `{error:{code:"NOT_FOUND",...}}`（4xx 契约），避免被前台兏底抢占而返回 HTML。

### Changed

- 不存在的文章 slug 不再返回纯文本 `Article not found`，改为走统一的 404 渲染入口（主题 404.hbs 或平台内置 404 页）。
- 主题契约扩展：新增**可选**模板 `404.hbs` 与 `templateExists` 探测，向后兼容（主题不提供则跳过）。
- 修订发版与 push 约定（见 `AGENTS.md` 与根 `CHANGELOG.md` 发布流程段）：Themes 仓库不打任何 tag、常规改动仅本地提交、仅正式发版时 bump `theme.yaml` version + CHANGELOG 版本段后 push 触发 CI；Frame 仓库常规改动保持原子化提交 + 同步 CHANGELOG、默认本地，仅迭代版本号时 bump `package.json` version + CHANGELOG 版本段 + 打 `v*.*.*` tag 后 push 触发 CI。

## [0.4.0] - 2026-09-05

### Added

- 媒体库支持分页浏览、每页条数选择（20/50/100，默认 20）与关键字搜索（按文件名/存储路径模糊匹配，防抖 350ms）。分页导航与每页选择器样式对齐访问记录页（`/admin/visits`：`min-w-8` 圆角 pill + 省略号 + `每页 [select] 条`），并置于媒体库卡片右上角。媒体网格改为 `auto-fill, minmax(240px,1fr)` 响应式布局，按窗口宽度灵活呈现 3 列或 4 列。

### Fixed

- 修复媒体库仅展示最新 100 张、更早的媒体（如先单独上传、随后批量导入文章附图时最早的那张）在后台不可见但仍可经 URL 访问的问题。根因：媒体页服务端硬编码 `page:1, pageSize:100` 并丢弃分页元信息，按 `createdAt desc` 截断后第 101 条以后的记录无法操作。现改为读取 `page/pageSize/q` 查询参数并完整分页，所有媒体均可翻页到达并删除；删除/上传后按当前页刷新或回到第 1 页，删尽当前末页时自动回退一页。
- 修复 `install.sh` 升级时只判断本地 `docker-compose.yml` 是否存在、从不与仓库最新版同步的问题。这会导致新版本引入的卷/服务（如 `seanblog_uploads`）不生效——镜像已是新版但 compose 仍是旧版，表现为数据不持久或功能异常。现改为始终拉取最新版比对：本地过期则备份（`docker-compose.yml.bak.<时间戳>`）后更新，相同则跳过，离线时回退本地版本。README「升级」章节同步补充警示：不要只用 `docker compose pull && up -d` 升级。

## [0.3.0] - 2026-09-04

### Fixed

- 修复后台「主题」页在客户端切换活跃主题后（如导入主题包后点击「启用」、或在多主题间切换），新主题中依赖默认值即勾选的级联设置项（典型如 Cardinal 的「侧边栏内容」默认含「个人简介」时，其下的头像/签名/自定义 HTML 等项）不显示、需刷新或重新勾选才出现的问题。根因是驱动显隐的 `liveValues` 仅在组件首次挂载时按当时活跃主题构建，切换主题后 schema 已变但 `liveValues` 未按新主题重新构建，导致 `computeVisibility` 把默认就应勾选的项判为不可见。现改为在活跃主题 slug 变化时重新由 schema 默认值 + 当前 `themeSettings` 构建 `liveValues`。
- 修复媒体库上传图片后前台无法查看（`/uploads/...` 返回 404）的问题。根因：上传文件写入 `public/uploads/`，而 Next.js 生产模式（standalone）仅在服务器启动时把 `public/` 文件清单缓存一次，运行时新增的文件不在缓存中、不会被服务（dev 模式 dev server 每次读文件系统，故本地开发不可见）。同时修复上传媒体在重建容器时丢失的问题（原 `public/uploads` 无持久化卷）。

### Changed

- 媒体存储迁出 `public/`：上传内容改写入独立存储根 `storage/uploads/`（可由 `UPLOADS_DIR` 覆盖；容器内 `/app/storage/uploads`，挂命名卷 `seanblog_uploads` 持久化），由新增的 catch-all 路由 `src/app/uploads/[...path]/route.ts` 流式服务（Content-Type、Range、长缓存、路径越界保护）。URL 前缀 `/uploads/` 不变；`Media.key` 规范化为相对存储根的相对路径（`media/{category}/{filename}`、`article-imports/{slug}/{filename}`），服务端按 URL 路径读取、不依赖 DB 查询。集中存储逻辑于 `src/lib/media/storage.ts`，为未来对象存储（S3/R2/MinIO）留接缝。文章导入附件同步迁入 `storage/uploads/article-imports/`。
- 新增一次性迁移脚本 `scripts/migrate-uploads-to-storage.mjs`（幂等、`--dry-run`），把历史 `public/uploads/*` 搬到 `storage/uploads/*` 并规范化 `Media.key`。

### 升级注意

升级到本版本后，需在服务器运行迁移脚本：

```bash
docker compose exec app node scripts/migrate-uploads-to-storage.mjs --dry-run   # 预览
docker compose exec app node scripts/migrate-uploads-to-storage.mjs             # 执行
```

## [0.2.1] - 2026-09-03

### Fixed

- 修复主题资源（`{{asset}}` 引用的 `assets/js/main.js` 等）在经 CDN/WAF 二次编码 URL 后返回 500 `INTERNAL_SERVER_ERROR` 的问题。根因是 `asset` helper 对路径做了 `encodeURIComponent`，`/` 被预编码成 `%2F`，再被中间层二次编码成 `%252F`，服务端解码一次后仍残留 `%2F` 导致文件命中失败。改为不再预编码斜杠，并在资源路由对查询串做防御性解码；缺失资源现返回 404 而非 500。

## [0.2.0] - 2026-09-03

### Added

- 部署支持通过 `APP_PORT` 环境变量自定义对外端口（默认 3000，仅改宿主机映射，容器内固定 3000）；`install.sh` 与 `docker-compose.yml` 均已支持。
- 后台设置页（站点信息 / 访问统计 / 页脚）保存通知统一为 toast 弹窗，替代底部红字提示。
- 页脚自定义 HTML（`publicFooterText`）与 RSS 显隐（`publicFooterShowRss`）接入 `seanblog-default` 主题 footer partial；容器为空样式，只继承字体颜色/大小，直接子元素 `margin` 清零，间距由内联 `style` 控制（`seanblog-default` 主题版本 2.1.0）。

### Changed

- CSRF 同源守卫（`requireSameOriginRequest`）在 `Origin` 未命中允许集合时回退检查 `sec-fetch-site`，修复反向代理/CDN 终结 TLS、`siteUrl` 缓存未预热等场景下合法后台请求被误判为跨站而 403 的问题；跨站 CSRF（`sec-fetch-site: cross-site`）仍被拦截。

### Removed

- 废弃的页头站点设置（`publicHeaderTitle`、`publicHeaderShowHome/ShowCategories/ShowTags/ShowSearch`）；页头导航/搜索/主题切换完全归主题 `theme.config.*` 控制。

## [0.1.0] - 2026-09-02

首个完整版本：一个面向长期使用的个人博客 CMS，用于替代 WordPress，基于 Next.js 单体全栈架构。

### Added

**内容与渲染**

- 文章管理：Markdown 文件存储，支持草稿 / 发布 / 归档 / 定时发布 / 置顶 / 修订历史 / ZIP 导入导出；区分文章与页面，页面不进首页列表
- Markdown 渲染管线：unified + remark/rehype + Shiki 代码高亮 + KaTeX 数学公式 + 标题自动锚点
- 分类与标签：slug 唯一性校验、批量操作
- 评论系统：嵌套回复、人工审核、黑名单规则、按文章关闭 / 只读

**后台管理**

- 媒体库：任意类型文件上传，按 MIME 分类存储，支持多选 / 粘贴 / 拖拽上传
- 后台概览仪表盘：统计卡片、文章热度、最近评论、趋势图
- 操作日志：记录浏览器指纹 / 硬件特征，保留期可配置，支持 CSV 导出

**主题系统**

- 基于 Handlebars 模板引擎 + 平台 `data-*` 渐进增强的前台主题框架
- 运行时上传与启用主题、版本化设置 schema（支持 select / range / textarea / list、条件显隐、1–2 层分组混用）、实时预览、设置快照导入导出与跨版本迁移
- 默认主题 `seanblog-default` 随镜像发布并种子到命名卷；`Cardinal` 主题设置兼容迁移

**访问分析**

- 访客与访问记录采集、每日物化统计、GeoIP 解析、GPU / 硬件特征规范化清洗后入库
- CSV 导出、交互式趋势图、访客维度下钻

**SEO**

- `seo_head` 注入 title / OpenGraph / canonical / JSON-LD
- `sitemap.xml`、`robots.txt`、`/rss.xml` 动态生成，站点 URL 来自后台设置运行时读取

**认证**

- Auth.js v5 Credentials Provider + JWT 会话，单管理员模式

**部署**

- Docker 多阶段构建：Next.js standalone 输出 + Postgres 16 + 一次性密钥初始化服务
- `docker-compose.yml` 编排：密钥生成、数据库健康检查、启动脚本自动 `migrate deploy` / 初始化管理员 / 初始化内容
- 单一 compose 文件同时声明 `image` 与 `build`：部署机只需下载 `docker-compose.yml` 即可拉镜像部署，加 `--build` 可从源码构建，无需维护两份文件
- `install.sh` 一键安装/升级脚本：自动检查依赖、下载 compose、拉镜像启动、等待就绪，并把首次管理员密码直接打印到终端
- GitHub Action：打 `v*.*.*` 标签自动构建多架构（amd64 / arm64）镜像推送 GHCR，并用本文件对应版本段落创建 GitHub Release
- 站点 URL 改为后台「站点信息」设置项运行时读取（带 30s 短缓存），镜像与站点域名解耦，无需重建即可改域名

**工程基线**

- TypeScript strict、Prisma 7、Tailwind CSS v4、Next.js 16 App Router（Turbopack）

### Security

- 内容安全策略（CSP）：放行 Google Fonts / cdnjs，其余默认收紧
- Handlebars 恢复默认 HTML 转义，修复评论存储型 XSS
- 主题 `cssVariable` 设置值在输出层转义，防 CSS 注入
- admin API same-origin 请求校验（Origin / Sec-Fetch-Site），防 CSRF
- 会话版本号吊销机制 + JWT `maxAge` 收紧到 7 天
