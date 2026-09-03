# Changelog

本文件记录 SeanBlog Frame 的显著变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

发布流程：打 `v*.*.*` 标签后，CI 从本文件提取对应版本段落作为 GitHub Release 正文。
新增变更时先写在 `## [Unreleased]` 下；发布前将其移至新的 `## [版本号]` 段落。

## [Unreleased]

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
