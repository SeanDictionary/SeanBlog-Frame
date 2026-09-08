# SeanBlog Frame 全面测试报告

- **测试日期**：2026-09-08
- **测试环境**：本地开发环境 `http://localhost:3000`（`npm run dev`，Next 16 + Prisma 7 + PostgreSQL）
- **被测版本**：Frame `0.5.0`，活跃主题 `cardinal 3.8.0`
- **数据规模**：76 篇文章、5 分类、56 标签、483 媒体、0 评论、106 访问 / 3 访客
- **测试方法**：Playwright 浏览器自动化（无障碍快照 + `evaluate` 实测数值）+ curl 计时 + 代码审阅 + Prisma 查询日志 + `tsc --noEmit`
- **测试人员**：AI Agent

> 本报告按「功能 Bug / 性能 / 内容与 SEO / 安全 / 可访问性 / 工程化」六个维度组织，每条给出**现象 → 复现 → 根因 → 建议**。
> 严重度标记：🔴 P1（应尽快修） / 🟠 P2（影响体验） / 🟡 P3（打磨项）。

---

## 一、总体结论

项目整体完成度高，前台渲染、后台管理、鉴权、SEO 基线均工作正常，`tsc --noEmit` 通过，错误边界与降级页完备。用户反馈的「点击页面要等一段时间」主要由 **全量 SSR 无缓存 + Shiki 每请求重渲染 + 搜索/列表的磁盘 Markdown 读取** 叠加导致，属架构层性能问题，非数据量问题（当前数据量极小）。

需优先处理的高价值项：
1. 🔴 前台 taxonomy（分类/标签）页 404 误报为 500
2. 🔴 移动端导航入口不可达
3. 🟠 前台性能（缓存 + Markdown 渲染缓存 + 搜索重构）

---

## 二、功能 Bug

### ✅ B1. 不存在的分类/标签页返回 500 而非 404（已修复）

- **状态**：✅ 已修复（2026-09-08）。
- **修复**：`src/lib/theme/public-error-page.ts` 的 `publicErrorResponse` 现识别 `ApiError.status`：404 统一走 `renderNotFoundResponse()`（优先主题 `404.hbs`，回退内置静态 404），其他业务错误码透传其 status。同时清理了 `articles/[slug]/route.ts` 里多余的手写 404 兜底。
- **验证**：`/tags/zzz-nonexistent`、`/categories/zzz-nonexistent`、`/tags/python`、`/articles/zzz-none` 均 → 404，且 404 页带主题 chrome（顶栏/页脚/返回顶部）。`tsc --noEmit` 通过。

### ✅ B2. 移动端导航入口不可达（已修复）

- **状态**：✅ 已修复（2026-09-08）。
- **修复**：cardinal 主题 `partials/header.hbs` 新增汉堡按钮（`data-cf-menu-toggle`）+ 移动菜单面板 `.cf-mobile-menu`（复用 `navItems`，`searchPosition=follow-menu` 时含搜索入口）；`assets/theme.css` 加窄屏显隐与抽屉样式；`assets/js/main.js` 加切换交互（点击项 / 外部点击 / Esc / 切回宽屏自动关闭，`aria-expanded`/`aria-label` 随状态切换）。
- **验证**：桌面 1488px 汉堡隐藏、导航可见、菜单永不显示；移动 390px 汉堡可见、点击展开 3 项（首页/分类/标签）、点击「分类」成功导航 `/categories` 且菜单自动关闭、外部点击关闭。无控制台错误。
- **同步**：改动已同步至 Themes 仓库 `cardinal/*`（三文件内容一致），CHANGELOG 记于 `cardinal/CHANGELOG.md` `[Unreleased]`。

### 🟡 B3. 文章页 `og:description` 为空

- **现象**：文章详情页 `<meta property="og:description">` 内容为空，而同名 `<meta name="description">` 已正确回退到 excerpt。
- **复现**：
  ```
  GET /articles/ecc-qi-yi-qu-xian
  <meta name="description" content="在几何中，对于一条曲线...">   ✓
  <meta property="og:description" content="">                      ✗ 空
  ```
- **根因**：`src/lib/theme/template-context.ts` 的 `buildPostCtx` 中：
  - `description` 用 `a.metaDescription || stripHtml(a.excerpt || contentHtml).slice(0,160)`
  - `og:description` 用 `a.metaDescription || ''`（未回退 excerpt）
- **建议**：让 `og:description` 与 `description` 共用同一回退逻辑（`metaDescription || excerpt || content 前 160 字`）。

### 🟡 B4. `favicon.ico` 404（控制台报错）

- **现象**：每个前台页面控制台出现 `GET /favicon.ico → 404`。后台 `siteIcon` 设置为空。
- **建议**：在 `public/` 放置默认 `favicon.ico`，或在 root layout 的 metadata 中显式声明 icon 路径，避免 404 噪声。

### 🟡 B5. media / logs 列表 `pageSize` 校验过严

- **现象**：`GET /api/admin/media?page=1&pageSize=3` → 400 `Page size must be 20, 50 or 100`；`/api/admin/logs?pageSize=3` → 400。其他列表（articles/tags）接受任意 pageSize。
- **影响**：API 行为不一致；若后台 UI 误传小 pageSize 会直接 400。当前 UI 用 20 不触发，但扩展性差。
- **建议**：统一列表分页校验策略（如统一为 `1–100` 区间，或所有列表都用枚举），保持各端点一致。

---

## 三、性能

> 用户主诉「点击页面要明显等一段时间」。实测：首页暖请求 ~110–135ms，文章页暖 ~120–176ms，但**首请求（冷）** 文章页 ~957ms、taxonomy ~955ms。当前数据量极小，慢感**不是数据库扫描慢**，而是「无缓存 SSR + 每请求重渲染 Markdown + 多次冗余查询 + 搜索读盘」叠加。

### 🟠 P1. 前台全量 `force-dynamic`，零缓存

- **现象/根因**：所有前台 route handler 均 `export const dynamic = 'force-dynamic'`（`route.ts` / `[...path]` / `articles/[slug]` / `tags/[slug]` / `categories/[slug]` / `search`）。每个请求都完整执行：查库 → 读 Markdown 文件 → Shiki 高亮 → Handlebars 渲染 → 返回 HTML。无 ISR、无 `Cache-Control`、无 `revalidate`、无 `unstable_cache`（仅主题设置有 5 分钟缓存）。
- **影响**：首请求冷启动（Shiki 引擎初始化 + 模块编译）~1s，后续 ~150ms 但仍每次走全链路。生产环境数据量上去后会显著放大。
- **建议**：
  - 对首页 / 分类标签索引 / 文章详情改为 `export const revalidate = 300`（或 ISR），文章详情可按 `slug` 做 `generateStaticParams` + 按需 revalidate（发布/更新时调 `revalidatePath`）。
  - 对响应加 `Cache-Control: s-maxage=60, stale-while-revalidate` 之类头。
  - 文章详情「发布即静态、编辑后 revalidate」是最贴合博客场景的形态。

### 🟠 P2. `baseCtx()` 每页重复查询侧边栏 + 站点设置

- **现象**：Prisma 日志显示每个前台页面都执行：
  - `SELECT ... FROM SiteSetting WHERE key='siteUrl'`（getSiteUrl，有 30s 内存缓存）
  - `SELECT ... FROM SiteSetting ORDER BY key`（listSettings，**无缓存**，每次全表）
  - 侧边栏 3 个查询：`listPublicArticles(12 篇含 tags/category/commentCount)`、`listPublicTags(50)`、`listPublicCategories(50)`
- **根因**：`src/lib/theme/template-context.ts` 的 `baseCtx()` 在每个页面 ctx 构建时调用 `getMergedSettings()` + `loadSidebarData()`，二者均无 request 级或 TTL 缓存。`getMergedSettings` 内部 `getSiteSettingsMapSafe()` 又调 `listSettings()`（仅 `siteUrl` 单独有缓存，整表设置 map 没有）。
- **建议**：
  - 给 `getSiteSettingsMap()` 加 `unstable_cache`（5 分钟，保存时 `revalidateTag('settings')`，与 `getThemeSettings` 一致）。
  - 给 `loadSidebarData()` 加 `unstable_cache` + 在文章发布/删除时 `revalidateTag('sidebar')`。
  - 至少在 request 级用模块变量做单次缓存（同一请求内 `baseCtx` 被调一次，但首页+多次重复请求间仍重复）。

### 🟠 P3. Markdown + Shiki 每请求重渲染

- **现象**：文章详情每次渲染都执行 `markdownToHtml(markdown)`（`src/lib/content/markdown.ts`），走 `remark → rehype → @shikijs/rehype → rehype-stringify` 全链路。冷首请求 ~960ms 主要花在 Shiki 引擎初始化 + 高亮。
- **根因**：渲染结果未缓存；文章正文存文件系统，每请求读盘 + 全量重渲染。
- **建议**：
  - 渲染产物缓存到 DB（`Article.contentHtml` 字段已存在！当前文章详情用的是文件 Markdown 实时渲染，未利用 `contentHtml`）。**在保存/更新文章时一次性渲染 `contentHtml` 入库**，前台直接读 `contentHtml`，彻底消除每请求 Shiki 开销。这是性价比最高的一步。
  - 或对渲染结果做 `unstable_cache`（key=文章 updatedAt 时间戳），更新时自动失效。

### 🟠 P4. 搜索是「全表扫描 + 每候选读盘」

- **现象**：`/search?q=arch` ~290ms vs `/search?q=ctf` ~190ms（`arch` 命中少 → 更多候选读 Markdown 文件）。
- **根因**：`src/lib/services/article-service.ts` 的 `searchArticles`：
  1. `findMany` 取最多 `SEARCH_CANDIDATE_LIMIT=200` 篇候选（仅 metadata）；
  2. 对 metadata 不含关键词的候选，逐个 `readMarkdownFromStorage()`（**文件系统读 + 最多 200 次**）做 `textIncludesAllSearchTerms`；
  3. 在内存里分页。
  - 后台搜索 `listAdminArticles(q)` 走同一模式（`adminArticleSearchSelect` + `articleMatchesQuery`）。
- **影响**：文章增多后搜索耗时与候选数线性增长，且每次搜索都打文件系统。
- **建议**：
  - 短期：把可搜索文本预生成（保存文章时把 `title + excerpt + 纯文本正文` 拼到 `Article` 的一个 `searchText` 列 / 或利用已废弃的 `contentMarkdown`/`contentHtml` 列做 `ILIKE`），搜索改成 SQL `WHERE searchText ILIKE %q%`，去掉 200 次读盘。
  - 中期：上 PostgreSQL `tsvector + GIN` 全文索引或 `pg_trgm`，支持中文分词后体验更好。
  - `articleMatchesQuery` 现有 metadata 优先短路是好的，但正文兜底必须脱离每请求读盘。

### 🟡 P5. 上下篇导航加载全部文章

- **现象/根因**：`getPublicArticleNavigation(slug)`（`article-service.ts`）`findMany` 取**所有**已发布文章的 `title+slug`（按时间排序），再在内存里 `findIndex` 找当前文章的 prev/next。
- **影响**：文章数增长后单次文章详情多一个全量查询。
- **建议**：改为两条索引查询：`WHERE publishedAt < current ORDER BY publishedAt DESC LIMIT 1` + `WHERE publishedAt > current ORDER BY publishedAt ASC LIMIT 1`。`publishedAt` 已有默认索引（建议确认 `@@index([publishedAt])`）。

### 🟡 P6. 列表页 excerpt 为空时每篇读盘

- **现象/根因**：`withPublicArticleListExcerpt`（`article-service.ts`）：若文章 `excerpt` 为空，则 `readMarkdownFromStorage(article)` + `createExcerpt`。首页/分类/标签/搜索列表每篇都可能触发一次文件读。
- **建议**：保存文章时强制生成并写入 `excerpt`（`buildArticleData` 已在 `contentMarkdown` 变更且 `excerpt` 为空时生成，但生成结果**没有持久化回 DB**，仅作为返回值）。把生成的 excerpt 落库，列表页即可零读盘。

### 🟡 P7. 站点设置整表每请求查询

- 已并入 P2。`getSiteUrl` 有 30s 缓存，但 `listSettings`（全表）无缓存，每页都查。建议见 P2。

### 性能实测数据汇总（dev 模式，本地）

| 路由 | 修复前冷/暖 | 修复后冷/暖 |
|---|---|---|
| `/` 首页 | ~124ms / 109–135ms | ~325ms / **~80ms** |
| `/articles/arch-shi-yong-zhi-nan` | ~957ms / 120–176ms | ~300ms / **~80ms** |
| `/search?q=arch` | — / ~290ms | — / **~135ms** |
| `/tags/zzz`（不存在） | — / 500 ✗ | — / 404 ✓ |

> 注：修复后冷请求略高（缓存构建），但暖请求大幅下降。生产 `next start` 暖请求会更快。

---

## 四、内容与 SEO

### 🟡 C1. 大量代码块未标注语言 → 无语法高亮
- **现象**：`/articles/mt19937` 有 13 个代码块，**0 个**带 `data-language`、**0 个**有 Shiki 着色 token；`/articles/next-sig-...` 的代码块也是纯文本容器（`pre.shiki` 但无 `<span style>`）。
- **根因**：源 Markdown 用的是裸 ```` ``` ```` 围栏，未写 ```` ```python ````。Shiki 对无语言代码块回退 plaintext（行为正确）。
- **建议**：属内容问题。可在后台编辑器加「代码块语言」提示 / 自动补全；或对已知特征（`def `/`import `→python）做轻量启发式标注（可选，谨慎）。短期建议作者补全围栏语言。

### 🟡 C2. 标题锚点 id 非语义
- **现象**：中文标题生成的 id 是 `toc-0`、`toc-1`（`getHeadings` 的 `slugify` 对纯非 ASCII 文本回退 `toc-N`）。
- **影响**：锚点可用但不可读，分享锚点不语义化。
- **建议**：对中文标题做拼音转换或保留原中文（URL fragment 支持任意 UTF-8），或至少用标题哈希保证稳定。

### ✅ SEO 基线良好
- 每页有 `<title>`、`<meta name="description">`、`<link rel="canonical">`、`og:type/og:title`、Article 页有 `application/ld+json`（schema.org Article）。
- `robots.txt`：`Disallow: /admin/` + sitemap 声明 ✓
- `sitemap.xml`：含首页 + 文章 ✓（`lastmod` 实时生成，合理）
- 唯一缺口是 B3（文章 og:description 空）。

---

## 五、安全

整体良好，未见可利用漏洞。

| 项 | 结果 |
|---|---|
| 未授权访问 admin API | → 401 ✓ |
| 未授权访问 admin 页面 | → 307 重定向 `/login` ✓ |
| 未授权 POST /api/admin/articles | → 401 ✓ |
| CSRF（跨站请求） | `/api/comments` 无 Origin/Referer → 403 `FORBIDDEN` ✓ |
| 评论 XSS（content） | `{{content}}` Handlebars 默认转义 ✓；存储为原文但渲染转义，安全 ✓ |
| 评论 `guestLink` 注入 | 校验必须 `http://`/`https://` 开头，拒绝 `javascript:` ✓ |
| 错误页堆栈泄漏 | `publicErrorResponse` 仅返回状态码+文案，堆栈仅 console.error ✓ |
| 登录 | next-auth Credentials + bcrypt + `sessionTokenVersion` ✓ |

- 建议（锦上添花）：评论 `guestName` / `content` 虽转义，可考虑服务端再走一层 `rehype-sanitize` 或长度限制（content 已有 `max(5000)`，guestName 建议加 `max`）。
- 后台 admin 密码见 AGENTS.md；登录页浏览器自动填充了旧密码，需确认 AGENTS.md 中密码与当前 DB 一致（本次用 AGENTS.md 密码登录成功 ✓）。

---

## 六、可访问性 & 交互

### ✅ 良好项
- 搜索 dialog 有 `role="dialog"`、`searchbox` 语义、ESC 关闭 ✓
- 暗色模式切换：`data-theme` 切换 + cookie 持久化，刷新保留 ✓（实测 light→dark→reload 仍 dark）
- 实时搜索：输入即时返回带 `<mark>` 高亮的结果 ✓
- 文章页 TOC 侧栏（`pre.shiki` 之外）+ KaTeX 数学渲染（ECC 文章 15 个 `.katex`）✓
- 代码高亮管线（Shiki + `languageLabelTransformer`）对带语言代码块生效 ✓
- 分页、排序、置顶、上下篇导航均工作 ✓

### 🟠 待修项
- **B2 移动端导航不可达**（见上，属交互可达性缺陷）。
- 🟡 搜索结果摘要把 `$\mathbb{F}_2$` 等原始 LaTeX 当纯文本展示（搜索列表 excerpt 未走 KaTeX），可在搜索结果里隐藏数学符号或渲染。
- 🟡 「返回顶部」按钮在快照中出现但无 `aria-label`（仅文本），建议加无障碍标签。
- 🟡 文章正文图片缺 `alt` 情况未抽样覆盖，建议编辑器对图片强制/提示 alt。

### 响应式
- 桌面（1488px）：三栏（顶栏 + 主内容 + 侧边栏）正常，无横向溢出 ✓
- 移动（390px）：主内容与侧边栏纵向堆叠 ✓、无横向溢出 ✓，**但顶栏导航隐藏且无替代入口**（B2）。

---

## 七、工程化

| 项 | 结果 |
|---|---|
| `npm run typecheck`（`tsc --noEmit`） | ✓ 通过，0 错误 |
| 错误边界 | `src/app/error.tsx` + `global-error.tsx` + `admin/error.tsx` + `admin/not-found.tsx` 齐全 ✓ |
| 前台降级 | `public-error-page.ts`「永不白屏」静态 HTML，DB 宕机 → 503 ✓ |
| 主题-平台契约 | `data-sb-*`（search/comment/theme-toggle/reply 等）接线清晰 ✓ |
| 版本自检 | `/api/admin/version` 返回 current/latest/hasUpdate ✓ |

- 🟡 后台概览页 `getAnalyticsOverview` 对 `AnalyticsEvent` 在同一时间范围执行多次全行查询（trend ASC、recent DESC、country、visitorId、userAgent 各一次），数据量大时偏重。建议合并为聚合查询或利用 `AnalyticsDailyStat`（已存在表）。
- 🟡 dev 控制台 `prisma:query` 日志极详细（`log: ['query','warn','error']`），生产已仅 `['error']` ✓，无问题。

---

## 八、后台管理功能测试结果

| 模块 | 结果 | 备注 |
|---|---|---|
| 登录 / 鉴权 | ✓ | next-auth，未授权 401/重定向 |
| 概览 `/admin` | ✓ | 76 文章 / 0 评论 / 106 访问 / 热度 Top6 / 30 天趋势图 |
| 统计总览 `/admin/overview` | ✓ | 含 2 表 + 图表 |
| 文章列表 | ✓ | 20 行/页，编辑链接正确 |
| 文章 CRUD（API） | ✓ | create 201 → update 200 → publish 200 → get 200 → delete 204，含版本修订 |
| 文章编辑器 | ✓ | title/slug/markdown 编辑器加载正常 |
| 分类 / 标签 | ✓ | 5 分类 / 56 标签，含文章计数 |
| 评论 | ✓ | 列表空（0 条），创建→PENDING→删除 204 |
| 媒体 | ✓ | 20 图缩略，上传 input + 筛选 select |
| 主题 | ✓ | Cardinal（启用）/ Default，settingsSchema 完整 |
| 设置 | ✓ | 7 项站点设置 |
| 日志 | ✓ | pageSize 校验见 B5 |
| 访客 / 访问记录 | ✓ | 3 访客，服务端组件直连 service |
| 版本自检 | ✓ | 0.5.0 / 无更新 |

---

## 九、修改优先级清单

| # | 项 | 严重度 | 位置 | 类型 |
|---|---|---|---|---|
| 1 | taxonomy 404 误报 500 | ✅ 已修复 | `src/lib/theme/public-error-page.ts` + tags/categories route | Bug |
| 2 | 移动端导航不可达 | ✅ 已修复 | `themes/cardinal` header/css/js | 主题 UX |
| 3 | 前台零缓存 SSR | ✅ 已修复 | 各 `route.ts` | 性能 |
| 4 | Markdown/Shiki 每请求重渲染 | ✅ 已修复 | `markdown.ts` + `article-service`（用 `contentHtml` 列） | 性能 |
| 5 | 站点设置 / 侧边栏每页查库 | ✅ 已修复 | `setting-service` / `template-context` | 性能 |
| 6 | 搜索全表扫描 + 读盘 | ✅ 已修复 | `article-service.searchArticles` | 性能 |
| 7 | 文章 `og:description` 空 | ✅ 已修复 | `template-context.buildPostCtx` | SEO |
| 8 | excerpt 不落库致列表读盘 | ✅ 已验证无问题 | `article-service` buildArticleData | 性能 |
| 9 | 上下篇加载全表 | ✅ 已修复 | `getPublicArticleNavigation` | 性能 |
| 10 | 代码块未标语言 | 🟡 P3 | 内容 / 编辑器提示 | 内容 |
| 11 | favicon 404 | ✅ 已修复 | `public/` + layout metadata | 体验 |
| 12 | media/logs pageSize 校验 | ✅ 已修复 | validations | 一致性 |
| 13 | 概览 analytics 多查询 | ️ 暂不修复（后台管理，数据量小） | `analytics-service.getAnalyticsOverview` | 性能 |

---

## 十、附录：关键代码定位

- 404 误判：`src/lib/theme/public-error-page.ts` `classifyError()` —— 仅判 `isDatabaseError`，未读 `ApiError.status`。
- 性能根因集中点：
  - `src/app/(public)/**/route.ts` —— `export const dynamic = 'force-dynamic'`
  - `src/lib/theme/template-context.ts` —— `baseCtx()` 每页 `getMergedSettings()` + `loadSidebarData()`
  - `src/lib/services/setting-service.ts` —— `getSiteSettingsMap()`（仅 `siteUrl` 有缓存）
  - `src/lib/content/markdown.ts` —— `markdownToHtml()` Shiki 全链路，无缓存
  - `src/lib/services/article-service.ts` —— `searchArticles` / `articleMatchesQuery`（读盘）/ `getPublicArticleNavigation`（全表）/ `withPublicArticleListExcerpt`（excerpt 空读盘）
  - `prisma/schema.prisma` —— `Article.contentHtml` 列已存在但前台未用于读取（潜力点）

> 建议优先落地 #4（用 `contentHtml` 列）+ #3（ISR/revalidate）+ #5（设置/侧边栏 unstable_cache），三者即可把「点击要等一会」的主诉覆盖掉大半。

## 补充修复（用户反馈）

### ✅ Favicon 显示问题
- **问题**：后台页面显示 favicon 但前台不显示；用户不需要默认图标
- **修复**：移除默认 favicon.svg，仅当 siteIcon 配置时显示
- **文件**：`public/favicon.svg`（删除）、`src/app/layout.tsx`、`themes/cardinal/templates/default.hbs`

### ✅ 后台页面标题
- **问题**：后台所有页面标签页标题都是 "SeanBlog"，不随页面切换改变
- **修复**：为每个后台页面添加 metadata title
- **文件**：`src/app/admin/*/page.tsx`（11 个文件）、`src/app/admin/layout.tsx`

### ✅ 移动端汉堡按钮无响应
- **问题**：移动端 fa-bars 按钮点击没有反应
- **修复**：改用事件委托处理点击，更稳健
- **文件**：`themes/cardinal/assets/js/main.js`

### ✅ 移动端侧边栏位置
- **问题**：移动端侧边栏显示在文章列表末尾
- **修复**：移动端 (≤860px) 隐藏侧边栏
- **文件**：`themes/cardinal/assets/theme.css`
