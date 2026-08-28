# 主题框架设计（SeanBlog Theme Framework v2）

> 状态：设计稿（待审阅）。本文档推翻并替代旧版 `theme-development.md` 与 `cardinal-flexible-design.md`。
> 目标读者：框架实现者 + 主题包开发者。

## 1. 背景与目标

### 1.1 旧框架为何必须推翻

旧框架（v1）采用「可执行主题包」模型：主题用 `pages/*.tsx`（React/JSX）决定前台页面，由 Next 构建期打包或运行时 esbuild 编译加载。实测发现一条不可逾越的架构墙：

> **React Server Components 要求所有 React 模块在 Next 构建期进入模块图**，才能拿到 `react-server` 导出条件与单一 React 实例，客户端组件（评论表单、搜索弹窗、移动端侧栏）才能被 RSC 正确识别与水合。
>
> 运行时通过 zip 上传、不在已构建产物中的主题，无法走 RSC 渲染——服务端加载的 CJS 主题页能渲染纯服务端 JSX，但一碰到客户端组件就 `useContext` 拿不到 dispatcher 而崩溃。构建期打包方案虽对「随仓库构建的主题」可用，但与「生产随时上传启用、不重新部署」的硬需求冲突。

因此 v2 放弃「主题 = React/JSX 代码」的路线，转向业界验证过的「服务端模板引擎」路线。

### 1.2 硬需求

1. **生产环境随时上传随时启用，无需重新构建部署**——与 WordPress / Ghost / Halo 一致。
2. **高自定义**：主题可任意自定义布局、样式、内容显示（含文章卡片样式、列表/网格、侧栏结构、元信息显隐等）。
3. **完整 SSR/SEO**：前台首屏 HTML 服务端渲染，无客户端布局闪烁。
4. **安全**：上传的主题不能执行任意服务端代码；CSS / 资源 / 模板都受控。

### 1.3 非目标

- 不要求主题可携带任意第三方 npm 依赖并在服务端执行。
- 不要求前台布局由 React 水合驱动（交互改由平台 Web Components 与主题自有 JS 承担）。

## 2. 业界调研

| 框架 | 主题形态 | 模板引擎 | 运行时上传 | 完整 SSR | 备注 |
|---|---|---|---|---|---|
| WordPress | PHP 模板 + `theme.json` | PHP | ✅ | ✅ | 生态最大，`functions.php` 可挂逻辑 |
| Ghost | `.hbs` + `package.json` | Handlebars | ✅ | ✅ | **Node 博客最近参照**，设置放 `config.custom` |
| Halo | `.html` + `theme.yaml`/`settings.yaml` | Thymeleaf 方言 | ✅ | ✅ | 设置 schema 用 FormKit，支持条件显隐 |
| Axero | `.html` + 配置 | Handlebars.Net | ✅ | ✅ | 企业社区，Page Builder 模板 |
| Hugo | Go 模板 + `config` | Go text/template | ❌ 构建期 | ✅ | 静态站，换主题需重建 |
| Astro | `.astro` | Astro 模板 | ❌ 构建期 | ✅ | 群岛架构，主题为集成而非上传包 |

**共性结论**：满足「运行时上传 + 任意布局 + 完整 SSR」的框架（WordPress / Ghost / Halo / Axero）**无一例外采用服务端模板引擎**，且模板引擎与平台交互解耦——交互由「平台提供的、构建期就绪的客户端脚本 + 模板里放占位元素（data 属性或自定义元素）」承担。Hugo / Astro 不满足运行时上传，排除。

**选型**：SeanBlog 是 Next.js 项目，最贴近 Ghost（Node + Handlebars）。本设计采用 **Handlebars 模板引擎 + 平台 Web Components** 组合。

## 3. 核心决策与替代方案

### 3.1 决策：Handlebars 模板 + 平台 Web Components

- **模板引擎：Handlebars**（`handlebars` npm）。理由：
  - Ghost 生态成熟，主题作者可借鉴 / 移植 Ghost 主题；
  - 自动 HTML 转义，沙箱化（无 `eval`，无任意代码执行）；
  - Node 原生，服务端渲染为字符串，无 React 实例 / react-server 问题；
  - 逻辑最小（helpers + partials），表达力足够覆盖博客布局需求。
- **平台交互：Web Components**。平台把评论、搜索、深浅色切换、移动侧栏、分页等交互件做成自定义元素（`<sb-comments>`、`<sb-search-dialog>`、`<sb-theme-toggle>`、`<sb-mobile-sidebar>`、`<sb-pagination>`、`<sb-toc>`），由平台统一构建的**单个客户端 bundle** 自动 `upgrade`。模板里只需放这些元素并给属性，无需水合、无需 React 跨边界。

### 3.2 替代方案与拒绝理由

- **JSX 静态渲染 + 群岛（react-dom/server renderToStaticMarkup + 选择性水合）**：能复用 React 组件，但需自建群岛水合机制（占位标记、客户端 bundle 装载、hydration），复杂度高且与 Next RSC 体系并行易踩坑；且主题作者仍受限 React。**不采用，但保留为后续平台 widget 升级到 React 群岛的路径**（Web Components 内部可用 lit/react 实现，对外仍是自定义元素）。
- **构建期打包（v1 方案）**：完整 SSR + 任意 JSX，但上传需重建部署，违背硬需求 1。**放弃**。
- **Liquid / Nunjucks**：能力相近，生态不及 Handlebars（博客领域）。**不采用**。

## 4. 架构总览

```
请求 GET /articles/{slug}
  → Next 路由处理器（非 RSC，Server Component 内调用模板渲染服务）
  → ThemeRenderService.render('article-detail', { post, ... })
      ├─ 取 activeTheme（SiteSetting，带缓存）
      ├─ 加载主题模板 themes/{slug}/templates/article-detail.hbs（+ default.hbs 布局）
      ├─ 构建上下文 ctx（site / post / content html / settings / theme.config / helpers）
      ├─ Handlebars.compile(template)(ctx)  → HTML 片段
      └─ 用 layout 包裹（default.hbs 的 {{{body}}} 注入片段；<head> 注入 seo_head + 平台 widget bundle）
  → 返回完整 HTML（Next 仍负责外层 <html>/<body> 或由 layout.hbs 接管整页）
  → 浏览器加载平台 widget bundle，自动 upgrade 所有 <sb-*> 元素
```

要点：

- **渲染发生在普通 Server Component / 路由处理器中**，用 `react-dom/server` 之外的方式产出 HTML 字符串，再用 `dangerouslySetInnerHTML` 或直接 route handler 返回。模板引擎与 React 完全分离，无 RSC 墙。
- **布局继承**：`default.hbs` 为整页骨架；页面模板用 `{{!< default}}` 嵌入，partials 用 `{{> partial-name}}`（Ghost 兼容语法）。
- **平台 widget**：模板里出现 `<sb-comments article-id="..."></sb-comments>` 等自定义元素；平台 bundle 在客户端 `customElements.define` 注册并对文档内所有匹配元素 upgrade。主题无需知道 React。
- **非交互内容**（文章正文、文章卡片、元信息、目录、上下篇导航、分页链接）由平台在上下文里提供 HTML 字符串或纯数据，主题用 `{{{html}}}`（不转义）或循环渲染。

## 5. 主题包结构

```text
my-theme/
  theme.yaml            # 清单
  settings.yaml         # 设置 schema（驱动后台表单）
  templates/            # Handlebars 模板（.hbs）
    default.hbs         # 整页布局（<html><head><body>{{{body}}}</body>）
    index.hbs            # 首页
    post.hbs             # 文章详情
    page.hbs             # 自定义页面（可选）
    archive.hbs          # 分类/标签归档（可合并为 taxonomy.hbs）
    author.hbs           # 作者页（可选）
    error.hbs            # 错误页（可选）
  partials/              # 可复用片段
    header.hbs
    footer.hbs
    post-card.hbs
    sidebar.hbs
    pagination.hbs
  assets/
    css/screen.css       # 主题样式
    js/main.js           # 主题自有交互（可选，纯 JS）
    img/...
  locales/               # i18n（可选）
    en.json
    zh.json
  screenshot.png         # 后台主题库展示图
```

页面模板与路由映射：

| 模板 | 路由 | 上下文 |
|---|---|---|
| `index.hbs` | `/` | `{ site, posts, pagination, settings }` |
| `post.hbs` | `/articles/[slug]` | `{ site, post, content(html), toc, navigation, comments, settings }` |
| `taxonomy.hbs`（或 `archive.hbs`） | `/categories/[slug]`、`/tags/[slug]` | `{ site, taxonomy, posts, pagination, settings }` |
| `categories.hbs` | `/categories` | `{ site, categories, pagination, settings }` |
| `tags.hbs` | `/tags` | `{ site, tags, pagination, settings }` |
| `search.hbs` | `/search` | `{ site, query, posts, pagination, settings }` |
| `default.hbs` | 所有页面外层 | 接收 `{{{body}}}`、`{{seo_head}}`、`{{asset}}` |

缺失模板自动 fallback 到 `base` 主题 → 默认主题 → 内置最小骨架，保证永不白屏。

## 6. 清单 `theme.yaml`

```yaml
slug: my-theme
name: My Theme
version: 1.0.0
author: { name: "...", url: "..." }
description: "..."
homepage: "..."
screenshot: screenshot.png
engine: seanblog-theme
engineVersion: 2
base: seanblog-default      # 缺失模板/资源从这里继承
assets:
  css: assets/css/screen.css
  js: assets/js/main.js      # 可选
templates:
  - index
  - post
  - taxonomy
  - categories
  - tags
  - search
requires: ">=2.0.0"          # 兼容的引擎版本
```

校验：`slug` 合法、`engine` 必须 `seanblog-theme`、`engineVersion` 必须等于当前主版本（不兼容则拒绝安装）、必填模板至少含 `index` 与 `post`。

## 7. 设置 `settings.yaml`

借鉴 Halo 的 `formSchema`（结构化、支持分组与条件显隐），比 Ghost 的扁平 `config.custom` 更适合丰富自定义。

```yaml
forms:
  - group: layout
    label: 布局
    formSchema:
      - $formkit: select
        name: sidebar_position
        label: 侧边栏位置
        value: right
        options:
          - { label: 无, value: none }
          - { label: 左侧, value: left }
          - { label: 右侧, value: right }
      - $formkit: select
        name: list_style
        label: 文章列表样式
        value: list
        options:
          - { label: 文字列表, value: list }
          - { label: 卡片网格, value: cards }
      - $formkit: multiselect
        name: meta_items
        label: 文章元信息
        value: [publishedAt, category, tags]
        options:
          - { label: 发布时间, value: publishedAt }
          - { label: 浏览量, value: viewCount }
          - { label: 分类, value: category }
          - { label: 标签, value: tags }
  - group: visual
    label: 视觉
    formSchema:
      - $formkit: color
        name: accent_color
        label: 强调色
        value: "#cf829e"
        cssVariable: --color-accent
      - $formkit: select
        name: color_mode
        label: 色彩模式
        value: auto
        options:
          - { label: 深色, value: dark }
          - { label: 浅色, value: light }
          - { label: 跟随系统, value: auto }
      - $formkit: boolean
        name: show_theme_toggle
        label: 前台深浅色切换按钮
        value: true
```

- 后台 `/admin/themes` 按 schema 动态生成表单（沿用现有 `ThemesManager` 渲染逻辑，扩展支持 `multiselect` / 条件 `if`）。
- 保存到 `ThemeCustomization.settings`，与 schema 默认值合并后注入模板上下文 `theme.config.*`。
- 声明了 `cssVariable` 的项，其值自动写入 `:root` 注入到 `default.hbs` 的 `<head>`，与现有 `css-bundle.ts` 逻辑一致。

## 8. 模板 API（数据契约 + helpers + 自定义元素）

### 8.1 上下文（ctx）

```js
{
  site: { title, description, url, logo, locale },
  theme: { config: { ...settings }, slug, name },
  settings: { ...siteSettings },          // 站点级设置
  // 页面级数据
  posts: [ { id, title, slug, excerpt, coverImage, url, publishedAt, isPinned, category, tags, viewCount } ],
  post:  { id, title, slug, coverImage, publishedAt, updatedAt, category, tags, author, viewCount },
  content: "<html>...正文...</html>",     // 已渲染 HTML 字符串
  toc: [ { id, text, level } ],
  navigation: { previous: {title,slug}|null, next: {...}|null },
  comments: [ { id, content, author, createdAt, status, replies } ],
  pagination: { page, pageCount, total, prevUrl, nextUrl, pages:[{page,url,active}] },
  taxonomy: { name, slug, description, type },
  query: "搜索词"
}
```

### 8.2 平台 helpers（Handlebars，白名单注册）

| helper | 作用 |
|---|---|
| `{{asset "css/screen.css"}}` | 主题资源 URL，自动加版本指纹 → `/api/themes/{slug}/asset?v=...&path=...` |
| `{{{seo_head}}}` | 注入 `<title>`、meta、OG、JSON-LD、`<link rel=sitemap>`、`X-Robots-Tag`（后台路径 noindex） |
| `{{{theme_css}}}` | 主题 CSS + 设置变量 + callout CSS 合并包（复用 `css-bundle.ts`） |
| `{{{content}}}` | 文章正文 HTML（不转义） |
| `{{excerpt post}}` / `{{post.excerpt}}` | 摘要（无自定义则正文前 200 字） |
| `{{img_url cover size="m"}}` | 图片尺寸变体（预留） |
| `{{t "Featured"}}` | i18n，从 `locales/{locale}.json` 取 |
| `{{format_date publishedAt format="YYYY-MM-DD"}}` | 日期格式化 |
| `{{reading_time content}}` | 预估阅读时间（平台预处理，也可直接读 `post.readingMinutes`） |
| `{{> "partial-name"}}` | 引入 partial |
| `{{!< default}}` | 布局继承（页面模板首行） |

helpers 全部平台内置，**主题不能注册自己的 helper**（安全沙箱）。

### 8.3 平台 Web Components（自定义元素）

模板里放置即可，平台客户端 bundle 自动 upgrade。属性即数据，无需 React。

```hbs
<header>
  <sb-search-dialog></sb-search-dialog>
  <sb-theme-toggle></sb-theme-toggle>
</header>
<main>
  {{{content}}}
  <sb-toc headings="{{json toc}}"></sb-toc>          <!-- 文章目录 -->
  <sb-comments article-id="{{post.id}}" mode="enabled"></sb-comments>
  <sb-article-navigation prev="{{json navigation.previous}}" next="{{json navigation.next}}"></sb-article-navigation>
</main>
<aside>
  <sb-mobile-sidebar>{{> sidebar}}</sb-mobile-sidebar>
</aside>
<nav>
  <sb-pagination current="{{pagination.page}}" total="{{pagination.pageCount}}" pages="{{json pagination.pages}}"></sb-pagination>
</nav>
```

平台 widget bundle 在 `default.hbs` 的 `</body>` 前注入（`{{{platform_widgets}}}` helper），单个 JS 文件，`customElements.define` 注册全部 `<sb-*>`。主题自有 `assets/js/main.js` 可叠加（如菜单开关等主题级交互）。

> 实现注：Web Components 内部可用 `lit` 或原生实现；评论表单/搜索弹窗的逻辑从现有 React 组件迁移为 Web Component 等价物。React 继续用于后台管理面板，不受影响。

### 8.4 布局示例

`templates/default.hbs`：

```hbs
<!DOCTYPE html>
<html lang="{{site.locale}}" class="mode-{{theme.config.color_mode}}">
<head>
  {{{seo_head}}}
  <link rel="stylesheet" href="{{asset "css/screen.css"}}">
  {{{theme_css}}}
</head>
<body class="sb-layout list-{{theme.config.list_style}}">
  {{> header}}
  <main class="sb-main">{{{_layout_body}}}</main>   <!-- 页面模板注入点 -->
  {{> footer}}
  <script src="{{asset "js/main.js"}}" defer></script>
  {{{platform_widgets}}}
</body>
</html>
```

`templates/post.hbs`：

```hbs
{{!< default}}
<article class="post">
  <h1>{{post.title}}</h1>
  <sb-article-meta post="{{json post}}" items="{{json theme.config.meta_items}}"></sb-article-meta>
  {{#if post.coverImage}}<img src="{{post.coverImage}}" alt="">{{/if}}
  {{{content}}}
  <sb-article-navigation prev="{{json navigation.previous}}" next="{{json navigation.next}}"></sb-article-navigation>
  <sb-comments article-id="{{post.id}}"></sb-comments>
</article>
```

## 9. 渲染流程

1. 路由处理器（Server Component）调用 service 加载页面数据（复用现有 `article-service` 等）。
2. `ThemeRenderService`：
   - 读 `activeTheme`（带 `unstable_cache`，启用主题时失效）。
   - 读主题模板（fallback 链：活跃主题 → `base` → `seanblog-default` → 内置骨架）。
   - 构建上下文 `ctx`。
   - `Handlebars.compile(pageTemplate, { data })(ctx)` → 片段 HTML。
   - 用 `default.hbs` 包裹：`{{{_layout_body}}}` 注入片段，`{{{seo_head}}}`/`{{{theme_css}}}`/`{{{platform_widgets}}}` 由 helper 输出。
3. 返回整页 HTML。**文档归属**：主题 `default.hbs` 负责完整 `<!DOCTYPE html><html><head>…</head><body>…</body></html>`。为此公开路由组使用一个「透传根布局」（仅 `return children`，不再补 `<html>/<body>`），让主题 `default.hbs` 掌控整页；深浅色 `data-theme`、cookie、Font Awesome 等由 `default.hbs` 与平台 helper 输出（`<html lang=... data-theme=...>` 的属性由 helper 根据设置/cookie 生成）。后台、API、鉴权路由不受影响，仍用各自布局。
4. 浏览器收到完整 HTML + 平台 widget bundle → 自定义元素 upgrade → 交互可用。

**缓存**：按 `activeTheme` + 主题设置 tag 缓存渲染产物（`unstable_cache`），主题切换/设置变更时失效。文章详情按 slug tag。

## 10. 上传 / 启用 / 预览 / 卸载

### 10.1 上传（zip）

后台 `/admin/themes` 上传 `.zip`，服务端：

1. zip 安全校验（复用现有 `parseZip`）：Zip-Slip、压缩炸弹、文件数、大小（≤2MB）。
2. 解析 `theme.yaml`（manifest）：字段、引擎、版本、必填模板。
3. 解析 `settings.yaml`：schema 合法性。
4. Handlebars **预编译校验**：每个 `templates/*.hbs` 与 `partials/*.hbs` 用 `Handlebars.parse` 解析，语法错误则拒绝。
5. CSS 校验（复用 `validateThemeCss`）：postcss 解析、禁 `@import`/`!important`/远程 URL。
6. 资源引用校验：`{{asset}}` 指向的文件须存在于包内。
7. 解压到 `themes/{slug}/`，登记 manifest 到 `ThemeManifest` 缓存。
8. 失败则回滚（删目录）。**不构建任何 JS**（主题无服务端代码）。

### 10.2 启用

写 `SiteSetting.activeTheme = slug`，`revalidateTag('theme')` + `revalidatePath('/(public)','layout')`。即时生效，无需重启。

### 10.3 预览

`/theme-preview?theme=<slug>&page=home|post`，受管理员会话保护，**真实渲染该主题**（非内嵌占位）：加载目标主题模板 + 设置，渲染真实首页/文章页。与前台唯一区别是路由在管理员会话下可见。

### 10.4 卸载

非默认、非当前活跃主题可删；删除 `themes/{slug}/` 目录并清缓存。

## 11. 安全边界

- **模板沙箱**：Handlebars 自动转义，helpers 白名单，主题不能注册 helper / 不能 `require` 任何模块 → 主题无法执行服务端代码。
- **资源沙箱**：`{{asset}}` 仅允许相对路径，重写到 `/api/themes/{slug}/asset`；CSS 禁危险构造。
- **zip 沙箱**：路径穿越 / 超大 / 压缩炸弹 / 非法类型拦截。
- **平台 widget**：自定义元素逻辑由平台构建期打包，主题只能通过属性传数据，不能注入脚本到 widget 内部。
- **`{{json x}}` helper**：序列化对象为 JSON 并转义引号，防 XSS。

## 12. 与现有实现的推翻清单

### 移除

- `src/lib/theme/bundler.ts`（esbuild 主题编译 / 沙箱）。
- `src/lib/theme/resolver.ts` 的 `resolveThemePage` / `preloadTheme` / `purgeThemeBuild`（JSX 主题页加载）。
- `src/lib/theme/components.ts`（`data.components` 注入）。
- 主题的 `pages/*.tsx` 与 `lib/*.ts`（cardinal / seanblog-default 的 JSX 主题页）。
- 公开页面里 `themePageData` / `components: getThemeComponents()` 等注入逻辑。

### 复用

- `src/lib/theme.ts` 的 manifest 校验、zip 解析、CSS 校验、asset 读写、`readThemeCss`/`readThemeAsset`、`clearThemeCache`（改名为清模板缓存）。
- `src/lib/theme/css-bundle.ts`（主题 CSS + 设置变量 + callout 合并）。
- `src/lib/services/theme-settings-service.ts`（设置存储 + 缓存）。
- zip 安全校验、`/api/themes/[name]/asset` 路由、后台 `ThemesManager` UI 框架。

### 新增

- `src/lib/theme/handlebars-engine.ts`：Handlebars 实例、白名单 helpers 注册、模板加载与缓存、布局继承。
- `src/lib/theme/render-service.ts`：上下文构建 + 模板渲染 + layout 包裹 + seo_head/theme_css/platform_widgets helper。
- `src/lib/theme/template-context.ts`：页面数据 → ctx 的映射（复用现有 service）。
- `src/app/api/themes/[slug]/widget-bundle.js` 路由（或 Next 静态产物）：平台 Web Components bundle。
- 平台 Web Components 源码 `src/widgets/`：`sb-comments`、`sb-search-dialog`、`sb-theme-toggle`、`sb-mobile-sidebar`、`sb-pagination`、`sb-toc`、`sb-article-navigation`、`sb-article-meta`。从现有 React 组件迁移逻辑。
- `themes/seanblog-default/` 与 `themes/cardinal/` 重写为 Handlebars 模板包（cardinal 作为高自定义参考实现）。

### 路由层改造

公开页面（`src/app/(public)/**/page.tsx`）改为调用 `ThemeRenderService.render(pageKey, ctx)` 并以 `dangerouslySetInnerHTML` 输出，或改为 route handler 直接返回 HTML。根布局保留 cookie/`data-theme` 逻辑（深浅色）。后台、API、鉴权不受影响。

## 13. 迁移 cardinal

把现有 cardinal 的 JSX 主题页能力映射到模板：

| 现有 cardinal 设置 / 能力 | 模板化实现 |
|---|---|
| `sidebarPosition` / `sidebarSticky` / `sidebarContent` | `default.hbs` 条件渲染 `<aside>` + `partials/sidebar.hbs` 按 `theme.config.sidebar_content` 循环 |
| `articleListStyle`（list/cards） | `partials/post-card.hbs` 内按 `theme.config.list_style` 切换类名与结构 |
| `showHeroSection` / `showFeaturedSection` | `index.hbs` 条件块 |
| `colorMode` / `showThemeToggle` | `<html class="mode-{{...}}">` + `<sb-theme-toggle>` 显隐 |
| `fontFamily` / `borderRadius` / `accentColor` | `cssVariable` 注入 `:root` |
| `articleMetaItems` / `showReadingTime` | `<sb-article-meta items="{{json theme.config.meta_items}}">` |
| TOC / 评论 / 分页 / 移动侧栏 | 对应 `<sb-*>` 自定义元素 |

## 14. 风险与未决项

1. **平台 Web Components 迁移成本**：评论表单、搜索弹窗需从 React 重写为 Web Component，工作量集中但一次到位。可先用原生实现最小可用，再迭代。
2. **交互一致性**：Web Components 与后台 React 体验需对齐（如表单校验、toast）。建议抽公共逻辑。
3. **i18n**：`{{t}}` helper 需与站点语言联动；初期可只支持 zh-CN。
4. **性能**：每请求渲染模板 + 合并 CSS，依赖 `unstable_cache` + 路径级缓存；文章详情可 ISR 化。
5. **SEO helper `{{{seo_head}}}`**：需把现有 `generateMetadata` 产出迁移到模板 helper，保证 OG/sitemap/JSON-LD 不丢。
6. **整页 `<html>` 归属**：公开路由组需改用透传根布局，`<html>/<head>/<body>` 由主题 `default.hbs` 输出；深浅色属性与 cookie 逻辑从 `src/app/layout.tsx` 迁到 helper / `default.hbs`。后台不受影响。
6. **默认主题**：`seanblog-default` 必须作为 Handlebars 模板包存在，且保证永不删除；其模板同时是 fallback 兜底。
7. **后台表单**：`settings.yaml` 的 FormKit 风格 `if` 条件与 `multiselect` 需在 `ThemesManager` 实现（部分已具备）。

## 15. 验收标准（实现完成后）

- [ ] 上传一个 zip 主题包，后台立即出现并启用，前台即时切换，**无重新部署**。
- [ ] 主题可通过模板任意定义布局、列表样式、侧栏、元信息显隐、配色，并经设置面板实时生效。
- [ ] 前台首屏 HTML 含完整正文与结构（curl 可见），Lighthouse SEO ≥ 90。
- [ ] 评论、搜索、深浅色切换、移动侧栏在主题切换后仍可用（平台 widget 不依赖主题）。
- [ ] 恶意主题包（含 `require`、`<script>` 注入、路径穿越、超大 zip）被拒绝。
- [ ] 预览页与前台渲染一致。
