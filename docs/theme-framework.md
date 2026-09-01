# 主题框架设计（SeanBlog Theme Framework v2）

> 状态：已实现（随仓库默认主题 `seanblog-default` 发布）。本文档推翻并替代旧版 `theme-development.md` 与 `cardinal-flexible-design.md`。
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
- 不要求前台布局由 React 水合驱动（交互改由平台 data-* 渐进增强脚本与主题自有 JS 承担）。

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

**选型**：SeanBlog 是 Next.js 项目，最贴近 Ghost（Node + Handlebars）。本设计采用 **Handlebars 模板引擎 + 平台 data-* 渐进增强** 组合。

## 3. 核心决策与替代方案

### 3.1 决策：Handlebars 模板 + 平台 data-* 渐进增强

- **模板引擎：Handlebars**（`handlebars` npm）。理由：
  - Ghost 生态成熟，主题作者可借鉴 / 移植 Ghost 主题；
  - 自动 HTML 转义，沙箱化（无 `eval`，无任意代码执行）；
  - Node 原生，服务端渲染为字符串，无 React 实例 / react-server 问题；
  - 逻辑最小（helpers + partials），表达力足够覆盖博客布局需求。
- **平台交互：data-* 渐进增强**。主题完全拥有 markup 与样式；需要 JS 的行为（评论提交、搜索触发、深浅色持久化、移动侧栏开合、TOC 高亮）由主题给元素挂 `data-sb-*` 属性，平台一段不 intrusive 脚本（`{{{platform_enhance}}}`）按约定接线。**不挂也能静态展示，只是无交互**——渐进增强。极少数复杂内部 UI（搜索结果列表）由平台渲染，主题只放触发按钮。该模型最大化主题样式自由度，且不抢 markup。

### 3.2 替代方案与拒绝理由

- **JSX 静态渲染 + 群岛（react-dom/server renderToStaticMarkup + 选择性水合）**：能复用 React 组件，但需自建群岛水合机制（占位标记、客户端 bundle 装载、hydration），复杂度高且与 Next RSC 体系并行易踩坑；且主题作者仍受限 React。**不采用**。
- **构建期打包（v1 方案）**：完整 SSR + 任意 JSX，但上传需重建部署，违背硬需求 1。**放弃**。
- **Liquid / Nunjucks**：能力相近，生态不及 Handlebars（博客领域）。**不采用**。

## 4. 架构总览

```
请求 GET /articles/{slug}
  → Next 路由处理器（非 RSC，Server Component 内调用模板渲染服务）
  → ThemeRenderService.render('article-detail', { post, ... })
      ├─ 取 activeTheme（SiteSetting，带缓存）
      ├─ 加载主题模板 themes/{slug}/templates/article-detail.hbs（+ default.hbs 布局）
      ├─ 构建上下文 ctx（site / post / content html / comments / navigation / settings / theme.config / helpers）
      ├─ Handlebars.compile(template)(ctx)  → HTML 片段
      └─ 用 default.hbs 包裹整页（<html><head> 注入 seo_head + theme_css；</body> 前注入 platform_enhance 脚本）
  → 返回完整 HTML（公开路由透传根布局，<html> 由 default.hbs 接管）
  → 浏览器加载平台增强脚本，按 data-* 属性对主题 markup 做渐进增强（提交、搜索、开合…）
```

要点：

- **渲染发生在普通 Server Component / 路由处理器中**，Handlebars 产出 HTML 字符串输出。模板引擎与 React 完全分离，无 RSC 墙。
- **布局继承**：`default.hbs` 为整页骨架；页面模板用 `{{!< default}}` 嵌入，partials 用 `{{> partial-name}}`（Ghost 兼容语法）。
- **主题完全拥有 markup 与样式**：列表、卡片、元信息、目录、上下篇、分页链接、评论列表与表单等全部由主题用 ctx 数据自行渲染。平台不抢 markup。
- **平台只提供 data-* 渐进增强**：主题给元素挂 `data-sb-*` 属性（如 `<form data-sb-comment-form>`），平台一段不 intrusive 脚本按约定接线行为（提交、同源守卫、状态反馈）。不挂也能静态展示，只是无交互——符合渐进增强。
- **极少数复杂内部 UI 由平台包办**：仅搜索结果列表等主题改了反而坏的部分由平台渲染，主题只放触发按钮。
- **非交互内容**（文章正文）由平台预渲染为 HTML 字符串注入，主题用 `{{{content}}}`（不转义）输出。

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

> 前台路由是返回整页 HTML 的 Route Handler，不走 React 渲染管线，因此 `error.tsx` 边界无法捕获其抛出的错误。当数据库不可用等异常发生时，`error.hbs` 自身也因依赖主题 CSS bundle（需查 DB）而无法渲染。为此前台 Route Handler 在最外层 try/catch，由 `src/lib/theme/public-error-page.ts` 生成一个脱离 DB/主题的自包含静态 HTML 回退页（复用默认主题 token 与 ErrorFallback 文案），DB 错误返回 503、其他错误返回 500，并输出可排查的错误码，保证前台「永不白屏」。

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

### 7.1 实际实现：`settingsSchema` 与条件显隐

实际 `theme.yaml` 采用 `settingsSchema`（而非 Halo 的 `forms`/`$formkit`），**支持 1 层与 2 层分组混用**，字段如下：

```yaml
settingsSchema:
  布局结构:
    - key: sidebarPosition          # 设置 key，注入 theme.config.sidebarPosition
      label: 侧边栏位置             # 后台表单标签
      type: select                  # text|color|number|boolean|select|list|multiselect
      default: right
      description: 可选说明文案
      cssVariable: --color-accent   # 可选，值写入 :root 变量
      options:                      # select / multiselect 必填
        - { label: 无, value: none }
        - { label: 右侧, value: right }
      itemFields:                   # list 专有：每行子字段
        - { key: url, label: 链接, type: text }
      if: "sidebarPosition !== 'none'"  # 可选：条件显隐表达式
      min: 0                          # range 专用
      max: 50
      step: 1
```

**支持类型**：`text` `color` `number` `boolean` `select` `list` `multiselect` `range` `textarea`。
- `range`：滑块，配 `min`/`max`/`step`，值存储为数字。
- `textarea`：多行文本，适合 HTML 片段等。
- `list`：多行条目，每行由 `itemFields` 组成（如导航项 link/label）；保存时按 `${key}[i].field` 收集。

**分组层级**：组的值既可以是项数组（1 层），也可以是「子组名 → 项数组」（2 层），两种组可在同一 schema 混用。2 层适用于项较多的组（如布局、视觉），小组保持 1 层即可。

```yaml
settingsSchema:
  布局结构:               # 2 层
    顶栏:
      - key: showTopBar
        type: boolean
      - key: headerBehavior
        if: "showTopBar === true"
    侧边栏:
      - key: sidebarPosition
      - key: sidebarSticky
        if: "sidebarPosition !== 'none'"
  页脚浮动:               # 1 层
    - key: showBackToTop
      type: boolean
```

后台按层级渲染（组 h3 → 子组 h4 → 项）；空组、空子组自动隐藏。

**Handlebars helper**：`{{#limit arr 10}}...{{/limit}}` 限制遍历条数（用于「少量 + 更多」）；另有 `eq`/`ne`/`gt`/`or`/`not`/`format_date`/`truncate`/`asset`/`t`。

**条件显隐 `if`**（FormKit/Halo 风格字符串，**不使用 eval**，内置安全迷你求值器）：

- 表达式为假时，该项在后台不渲染，且**不参与本次保存**（服务端部分合并保留其原值）。
- 支持：`==` `!=` `===` `!==` `&&` `||` `!` `()`；字符串 / 数字 / 布尔 / `null` / `undefined` 字面量；标识符（即其他设置 key，缺失视为 `undefined`）。
- 成员运算：`'x' in arr`（数组包含）、`'x' not in arr`（取反）、`'x' in str`（子串）。用于 multiselect 联动。
- 标识符支持点号取值 `obj.key`。布尔项与字符串 `true`/`false` 可互通比较。
- **级联隐藏**：子项引用的父项若被隐藏，子项自动隐藏，无需在子项里重复根条件。例如 `sidebarContent`（`if: sidebarPosition !== 'none'`）被隐藏时，所有 `if` 引用 `sidebarContent` 的子项（如 `profileContent`）一并隐藏。
- 语法非法时该项仍然显示并输出控制台警告，避免锁死设置；循环依赖检测到时按可见处理并告警。

示例：

```yaml
- key: sidebarSticky
  if: "sidebarPosition !== 'none'"
- key: heroStyle
  if: "showHeroSection === true"
- key: showArticleNav
  if: "articleListStyle === 'list' && listSeparator !== 'card'"
# 多层依赖 + 级联隐藏
- key: sidebarContent
  if: "sidebarPosition !== 'none'"
- key: profileContent
  if: "'profile' in sidebarContent"   # sidebarContent 隐藏时本项自动隐藏
```

求值器实现见 `src/lib/theme/setting-condition.ts`（导出 `evaluateCondition` / `extractReferencedKeys` / `computeVisibility`）；后台联动逻辑见 `src/components/admin/themes-manager.tsx`（顶层 `liveValues` + `computeVisibility` 驱动显隐 + 仅提交可见项）。

## 8. 模板 API（数据契约 + helpers + data-* 增强）

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
| `{{{platform_enhance}}}` | 在 `</body>` 前注入平台渐进增强脚本（评论提交、搜索触发、深浅色持久化、侧栏开合、TOC 高亮等 data-* 接线），单个 JS |

helpers 全部平台内置，**主题不能注册自己的 helper**（安全沙箱）。额外的“取数”需求用受控 `{{#get}}` helper（见 §8.5）。

### 8.3 交互模型：主题拥有 markup + 平台 data-* 渐进增强

**原则**：全部可见 markup 与样式由主题用 ctx 数据自行渲染；平台不抢 markup。需要 JS 的行为，主题给元素挂 `data-sb-*` 属性，平台一段不 intrusive 脚本（`{{{platform_enhance}}}`）按约定接线。**不挂也能静态展示，只是无交互**——渐进增强。

这是 Ghost 式模型，最大化主题样式自由度，同时避免每个主题重写提交/同源守卫/状态反馈/限流等公共行为。

| 行为 | 主题 markup 约定 | 平台脚本接管 |
|---|---|---|
| 评论提交 | `<form data-sb-comment-form data-article-id="{{post.id}}">` 含 `name="content"`/`parentId`/`visitorName` 等；状态位 `<p data-sb-comment-status>` | 拦截 submit → POST `/api/comments`（同源守卫 + 访客指纹自动注入 + 限流 + 审核模式）；按返回给 form 加 `data-state="submitting\|success\|pending\|error"` 并在 status 位写提示；保留输入。回复：`<button data-reply-to="{{id}}">` 自动填 `parentId` |
| 搜索触发 | `<button data-sb-search>` | 点击打开平台搜索弹窗（结果列表由平台渲染） |
| 深浅色切换 | `<button data-sb-theme-toggle>` | 点击切换 `<html data-theme>` + 写 `sb-theme` cookie（与现 v1 行为一致） |
| 移动侧栏 | `<button data-sb-sidebar-toggle target="#sidebar">` + `<aside id="sidebar">` | 点击切换目标 `aria-expanded` / open class，主题用 CSS 响应 |
| TOC 高亮 | `<nav data-sb-toc>` 内含 `a[href="#id"]` | 滚动时给当前项加 `aria-current` |
| 分页 / 元信息 / 上下篇 / 评论列表 / 文章卡片 | 纯主题 markup（数据已给） | 无需 JS，server 链接/静态 |

> 极少数复杂内部 UI（搜索结果列表）由平台渲染，主题只放触发按钮。其余全部主题 markup + 可选 data 增强。

#### 8.3.1 评论完整示例

```hbs
<section class="comments">
  <h2>{{comments.length}} 条评论</h2>

  {{#each comments}}
  <article class="comment" data-id="{{id}}">
    <header>{{author}} · {{format_date createdAt}}</header>
    <div>{{content}}</div>
    <button type="button" data-reply-to="{{id}}">回复</button>
  </article>
  {{/each}}

  {{#if (ne commentsMode "disabled")}}
  <form data-sb-comment-form data-article-id="{{post.id}}">
    <input name="content" required>
    <input name="visitorName">
    <input type="hidden" name="parentId">
    <button type="submit">发表评论</button>
    <p data-sb-comment-status></p>
  </form>
  {{/if}}
</section>
```

状态样式：`[data-sb-comment-form][data-state="success"] { border-color: green }` 等。

#### 8.3.2 实现注

- 平台增强脚本是平台构建期打包的纯 JS（不依赖 React），按 `data-*` 选择器接线。
- 主题自有 `assets/js/main.js` 可叠加主题级交互。
- React 继续用于后台管理面板，不受影响。

### 8.4 布局示例

`templates/default.hbs`：

```hbs
<!DOCTYPE html>
<html lang="{{site.locale}}" data-theme="dark" class="mode-{{theme.config.color_mode}}">
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
  {{{platform_enhance}}}
</body>
</html>
```

`templates/post.hbs`：

```hbs
{{!< default}}
<article class="post">
  <h1>{{post.title}}</h1>
  <ul class="post-meta">
    {{#each (meta_items)}}<li>{{this}}</li>{{/each}}
  </ul>
  {{#if post.coverImage}}<img src="{{post.coverImage}}" alt="">{{/if}}
  {{{content}}}
  <nav data-sb-toc>{{#each toc}}<a href="#{{id}}">{{text}}</a>{{/each}}</nav>
  <nav class="post-nav">
    {{#if navigation.previous}}<a href="/articles/{{navigation.previous.slug}}">← {{navigation.previous.title}}</a>{{/if}}
    {{#if navigation.next}}<a href="/articles/{{navigation.next.slug}}">{{navigation.next.title}} →</a>{{/if}}
  </nav>
  {{!-- 评论：主题自己渲染 markup，挂 data-* 让平台接管提交行为 --}}
  <section class="comments">
    {{#each comments}}<article class="comment" data-id="{{id}}">{{author}} · {{content}}</article>{{/each}}
    <form data-sb-comment-form data-article-id="{{post.id}}">
      <input name="content" required>
      <button type="submit">发表</button>
      <p data-sb-comment-status></p>
    </form>
  </section>
</article>
```

### 8.5 受控取数 helper `{{#get}}`（可选出口）

默认 ctx 已含每个页面所需数据。当主题需额外数据（侧栏最近文章、相关文章、标签云），用受控 helper：

```hbs
{{#get "posts" limit="5" order="published_at desc"}}
  <ul>{{#each posts}}<li><a href="/articles/{{slug}}">{{title}}</a></li>{{/each}}</ul>
{{/get}}

{{#get "posts" related-to=post.id limit="3"}}...{{/get}}

{{#get "tags" limit="20"}}...{{/get}}
```

- 服务端同步执行，结果进首屏 HTML（SEO 不丢）。
- 白名单资源类型：`posts`/`pages`/`tags`/`categories`/`authors`。
- 白名单参数：`limit`（≤N）、`order`、`filter`（受控语法）、`related-to`、`include`。拒接任意字段。
- 只返回已发布公开数据；平台限流与缓存。主题不能任意查 SQL、不能调内部 API。

## 9. 渲染流程

1. 路由处理器（Server Component）调用 service 加载页面数据（复用现有 `article-service` 等）。
2. `ThemeRenderService`：
   - 读 `activeTheme`（带 `unstable_cache`，启用主题时失效）。
   - 读主题模板（fallback 链：活跃主题 → `base` → `seanblog-default` → 内置骨架）。
   - 构建上下文 `ctx`。
   - `Handlebars.compile(pageTemplate, { data })(ctx)` → 片段 HTML。
   - 用 `default.hbs` 包裹：`{{{_layout_body}}}` 注入片段，`{{{seo_head}}}`/`{{{theme_css}}}`/`{{{platform_enhance}}}` 由 helper 输出。
3. 返回整页 HTML。**文档归属**：主题 `default.hbs` 负责完整 `<!DOCTYPE html><html><head>…</head><body>…</body></html>`。为此公开路由组使用一个「透传根布局」（仅 `return children`，不再补 `<html>/<body>`），让主题 `default.hbs` 掌控整页；深浅色 `data-theme`、cookie、Font Awesome 等由 `default.hbs` 与平台 helper 输出。后台、API、鉴权路由不受影响，仍用各自布局。
4. 浏览器收到完整 HTML + 平台渐进增强脚本 → 按 `data-sb-*` 元素接线行为 → 交互可用。

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

- **模板沙箱**：Handlebars 自动转义，helpers 白名单，主题不能注册 helper / 不能 `require` 任何模块 → 主题无法执行服务端代码。`{{#get}}` 只返回公开数据、白名单参数。
- **资源沙箱**：`{{asset}}` 仅允许相对路径，重写到 `/api/themes/{slug}/asset`；CSS 禁危险构造。
- **zip 沙箱**：路径穿越 / 超大 / 压缩炸弹 / 非法类型拦截。
- **平台增强脚本**：行为逻辑由平台构建期打包，主题只能通过 `data-*` 属性传数据，不能注入脚本、不能篒改 fetch 目标。评论/搜索等提交走平台预置的同源守卫与限流。
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
- `src/lib/theme/render-service.ts`：上下文构建 + 模板渲染 + layout 包裹 + seo_head/theme_css/platform_enhance helper。
- `src/lib/theme/template-context.ts`：页面数据 → ctx 的映射（复用现有 service）。
- 平台渐进增强脚本源码 `src/widgets/enhance.ts`：按 `data-sb-comment-form`、`data-sb-search`、`data-sb-theme-toggle`、`data-sb-sidebar-toggle`、`data-sb-toc` 等选择器接线行为，复用现有 `/api/comments`、搜索 API、`sb-theme` cookie。构建为单个 JS 产物。
- 平台搜索弹窗 UI（`data-sb-search` 触发，结果列表由平台渲染）。
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
| `colorMode` / `showThemeToggle` | `<html data-theme>` 由 helper 生成 + `<button data-sb-theme-toggle>` 显隐 |
| `fontFamily` / `borderRadius` / `accentColor` | `cssVariable` 注入 `:root` |
| `articleMetaItems` / `showReadingTime` | 主题自行 `{{#each}}` 渲染元信息（数据已在 ctx） |
| TOC | `<nav data-sb-toc>` 含 `a[href="#id"]`，平台脚本滚动高亮 |
| 评论 | 主题自渲染列表 + `<form data-sb-comment-form>` 提交 |
| 分页 | 主题自渲染 `{{#each pagination.pages}}` 链接 |
| 移动侧栏 | 主题 markup + `<button data-sb-sidebar-toggle>` |
| 上下篇 | 主题自渲染 `navigation` 链接 |

### 7.2 主题设置快照、导入与导出

主题设置的数据库原始值保存在 `ThemeCustomization.settings`，并由 `settingsVersion` 记录对应的 schema 版本；读取时按「数据库设置（先迁移到当前版本） > `theme.yaml` 默认值」合并。主题导出可通过 `GET /api/admin/themes/:name?includeSettings=true` 将当前主题的**全量有效设置**写入 ZIP 根目录的 `theme-settings.json`；它不是数据库 JSON 的简单复制，而是按当前 schema 合并默认值后过滤未知字段，确保导出时未主动修改但实际生效的默认配置也会被备份。

设置快照格式为：

```json
{
  "formatVersion": 1,
  "theme": { "slug": "cardinal", "version": "3.3.13" },
  "settingsVersion": 1,
  "settingsSchemaHash": "sha256:...",
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "settings": {}
}
```

导入 ZIP 时 `theme-settings.json` 为可选文件。后台支持三种 `settingsMode`：

- `ignore`：只安装主题文件，忽略设置快照；
- `preserve`：当前主题已有 `ThemeCustomization` 时保留，没有时才应用快照；
- `restore`：应用快照并覆盖当前主题设置。

设置快照会校验格式版本、主题 slug、设置版本、schema hash、字段类型、select/multiselect 选项、range 范围、list 子字段以及 `calloutCustomCss`。schema 中新增字段不写入数据库，继续使用当前主题默认值；已删除或未知字段会被忽略并产生警告。快照版本低于当前主题版本时通过应用内迁移注册表逐版本迁移；没有迁移规则或快照版本更高时拒绝应用设置。迁移逻辑不执行主题包内任意代码。

主题删除成功后同步删除对应的 `ThemeCustomization` 记录，并清理主题设置缓存。默认主题和当前正在使用的主题仍然禁止删除。

以上能力由 `src/lib/theme/settings-snapshot.ts`、`src/lib/services/theme-settings-service.ts` 和主题管理 API 提供；主题包只需在后续版本中声明 `settingsVersion`，具体字段迁移规则由主题实现阶段补充。

1. **平台增强脚本迁移成本**：评论提交、搜索弹窗需从 React 重写为 data-* 渐进增强脚本，工作量集中但一次到位。可先做最小可用（评论提交 + 搜索触发 + 深浅色），再迭代 TOC 高亮/侧栏开合。
2. **交互一致性**：前台增强脚本与后台 React 体验需对齐（如表单校验、toast）。建议抽公共逻辑。
3. **i18n**：`{{t}}` helper 需与站点语言联动；初期可只支持 zh-CN。
4. **性能**：每请求渲染模板 + 合并 CSS，依赖 `unstable_cache` + 路径级缓存；文章详情可 ISR 化。
5. **SEO helper `{{{seo_head}}}`**：需把现有 `generateMetadata` 产出迁移到模板 helper，保证 OG/sitemap/JSON-LD 不丢。
6. **整页 `<html>` 归属**：公开路由组需改用透传根布局，`<html>/<head>/<body>` 由主题 `default.hbs` 输出；深浅色属性与 cookie 逻辑从 `src/app/layout.tsx` 迁到 helper / `default.hbs`。后台不受影响。
7. **默认主题**：`seanblog-default` 必须作为 Handlebars 模板包存在，且保证永不删除；其模板同时是 fallback 兜底。
8. **后台表单**：`settings.yaml` 的 FormKit 风格 `if` 条件显隐与 `multiselect` 均已在 `ThemesManager` 实现（条件求值器 `src/lib/theme/setting-condition.ts`，隐藏项不参与保存、原值由服务端部分合并保留）。

## 15. 验收标准（实现完成后）

- [x] 上传一个 zip 主题包，后台立即出现并启用，前台即时切换，**无重新部署**。
- [x] 主题包支持可选导出全量有效设置，并可在导入时选择忽略、保留当前配置或恢复覆盖。
- [x] 主题可通过模板任意定义布局、列表样式、侧栏、元信息显隐、配色，并经设置面板实时生效。
- [ ] 前台首屏 HTML 含完整正文与结构（curl 可见），Lighthouse SEO ≥ 90。
- [x] 评论、搜索、深浅色切换、移动侧栏在主题切换后仍可用（平台增强脚本与 API 不依赖主题）。
- [x] 恶意主题包（含 `require`、`<script>` 注入、路径穿越、超大 zip）被拒绝。
- [x] 预览页与前台渲染一致。

### 16. 当前已实现的主题设置生命周期

当前实现以 `theme.yaml.settingsSchema` 为设置结构来源，数据库中的 `ThemeCustomization.settings` 保存原始用户配置，读取时按「数据库设置 > schema 默认值」得到有效配置。主题导出支持 `?includeSettings=true`，将有效配置快照写入 ZIP 根目录的 `theme-settings.json`；导入支持 `ignore`、`preserve`、`restore` 三种 `settingsMode`。删除非默认且非当前主题时，会同步删除该主题的 `ThemeCustomization` 记录。

Cardinal 当前声明 `settingsVersion: 2`，并提供 v1 → v2 迁移：旧 `heroStyle` 映射为新的 `heroWidth`/`heroHeight`，旧 `cardTitleColor=auto` 映射为 `follow`。

`theme-settings.json` 使用 `formatVersion` 表示文件格式，使用 `settingsVersion` 表示主题设置 schema 版本，使用 `settingsSchemaHash` 检测设置结构变化。主题清单可声明 `settingsVersion`，没有声明时按 v1 兼容。设置迁移只允许由应用内注册的迁移函数执行，不执行主题包内任意脚本；Cardinal 当前已注册 v1 → v2 迁移规则。
