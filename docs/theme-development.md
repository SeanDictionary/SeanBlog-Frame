# 主题开发指引（SeanBlog Theme v2）

> 面向**主题包开发者**的权威文档。基于当前已实现的引擎编写，所有 API、上下文字段、`data-*` 契约均与源码一致。
> 架构与设计决策见 [`theme-framework.md`](./theme-framework.md)（那是框架实现者的架构文档，部分内容为设计期描述，开发请以本文为准）。

## 目录

- [1. 概述](#1-概述)
- [2. 快速开始](#2-快速开始)
- [3. 主题包结构](#3-主题包结构)
- [4. 清单 `theme.yaml`](#4-清单-themeyaml)
- [5. 设置 `settingsSchema`](#5-设置-settingsschema)
- [6. 模板系统](#6-模板系统)
- [7. 上下文（ctx）数据契约](#7-上下文ctx数据契约)
- [8. Handlebars helpers 参考](#8-handlebars-helpers-参考)
- [9. 平台渐进增强契约（`data-sb-*`）](#9-平台渐进增强契约data-sb-)
- [10. CSS 规范](#10-css-规范)
- [11. 资源与 `asset` helper](#11-资源与-asset-helper)
- [12. 设置快照：导出与导入](#12-设置快照导出与导入)
- [13. 上传 / 启用 / 预览 / 卸载](#13-上传--启用--预览--卸载)
- [14. 安全边界](#14-安全边界)
- [15. 完整最小主题示例](#15-完整最小主题示例)
- [16. 调试与常见坑](#16-调试与常见坑)

---

## 1. 概述

SeanBlog 前台采用 **Handlebars 服务端模板 + 平台 `data-*` 渐进增强** 模型（与 Ghost 一致）：

- 主题是纯 `.hbs` 模板 + `.css` + 可选 `.js` 的**资源包**，**不含任何服务端可执行代码**。
- 平台把每页数据组装为 `ctx`，用 Handlebars 渲染整页 HTML 返回（完整 SSR，利于 SEO）。
- 需要交互的行为分两类：
  - **平台负责**（碰平台 API 的）：评论提交、搜索。主题只需放带 `data-sb-*` 属性的占位元素，平台脚本（`{{{platform_enhance}}}` 注入的 `/enhance.js`）自动接线。
  - **主题自实现**（纯展示交互）：深浅色切换、移动侧栏开合、目录高亮、评论"回复"按钮等。默认主题 `seanblog-default` 的 `assets/js/main.js` 是参考实现，第三方主题可照搬或自写，不写也能静态展示（只是无交互）。

### 设计原则

- **运行时上传即用，无需重新部署**：主题包以 zip 上传到后台 `/admin/themes`，启用后前台即时切换。
- **主题完全拥有 markup 与样式**：列表、卡片、元信息、目录、分页、评论列表全部由主题用 ctx 自行渲染，平台不抢 markup。
- **安全沙箱**：主题不能注册 helper、不能 `require` 模块、不能执行服务端代码；CSS / 资源 / 模板均受校验。

---

## 2. 快速开始

### 2.1 最小可运行主题

一个能上传并启用的主题，最少需要：

```text
my-theme/
  theme.yaml              # 清单（声明 slug/name/version/engine 等）
  templates/
    default.hbs           # 整页布局（必需，接收 {{{body}}}）
    index.hbs             # 首页（必需）
    post.hbs              # 文章详情（必需）
  assets/
    theme.css             # 样式（清单 assets.css 指向它）
```

把目录打包成 zip（zip 根目录直接是 `theme.yaml`、`templates/`、`assets/`），到后台 `/admin/themes` 上传即可。详见 [§15 完整最小主题示例](#15-完整最小主题示例)。

### 2.2 本地开发循环

主题文件不在 Next 模块图内，**开发模式下每次渲染都从磁盘重读模板与 partials**（无 HMR，但改完刷新页面即生效）。

1. 把主题目录放到仓库根 `themes/<slug>/`（与 `seanblog-default` 同级）。
2. 启动 `npm run dev`。
3. 后台 `/admin/themes` 启用你的主题。
4. 直接编辑 `themes/<slug>/templates/*.hbs` 与 `assets/theme.css`，浏览器刷新即可看到变化。

> 生产模式下模板与 partials 编译后会缓存到进程内存，主题切换/更新/删除时由平台清缓存。本地开发无需关心。

### 2.3 预览

`/theme-preview?theme=<slug>&page=home|article`（管理员会话保护）真实渲染目标主题的首页/文章页，与前台渲染路径一致，用于上线前验证。

---

## 3. 主题包结构

```text
my-theme/
  theme.yaml              # 清单（必需）
  templates/              # Handlebars 页面模板（.hbs）
    default.hbs           #   整页布局，接收 {{{body}}}
    index.hbs             #   首页 /
    post.hbs              #   文章详情 /articles/[slug]
    taxonomy.hbs          #   分类/标签归档页 /categories/[slug]、/tags/[slug]
    categories.hbs        #   分类列表 /categories
    tags.hbs              #   标签列表 /tags
    search.hbs            #   搜索页 /search
  partials/               # 可复用片段（.hbs），按文件名（去 .hbs）注册为短名 partial
    header.hbs
    footer.hbs
    post-card.hbs
    pagination.hbs
    search-dialog.hbs
  assets/
    theme.css             # 主样式（清单 assets.css 指向）
    js/main.js            # 主题自有交互脚本（可选）
    img/                  # 图片资源（可选）
  theme-settings.json     # 设置快照（仅导出包含，手写无效；见 §12）
```

### 3.1 路由 → 模板映射

平台按固定映射选择页面模板（见 `render-service.ts` 的 `PAGE_TEMPLATE_MAP`）：

| 路由 | 模板文件 | pageKey |
|---|---|---|
| `/` | `index.hbs` | `home` |
| `/articles/[slug]` | `post.hbs` | `post` |
| `/categories/[slug]`、`/tags/[slug]` | `taxonomy.hbs` | `taxonomy` |
| `/categories` | `categories.hbs` | `categories` |
| `/tags` | `tags.hbs` | `tags` |
| `/search` | `search.hbs` | `search` |

整页由 `default.hbs` 包裹（布局机制见 [§6.2](#62-布局layout注入机制)）。

### 3.2 模板 fallback 链

缺失的模板/资源按链继承，**保证永不白屏**：

- **页面模板**：活跃主题 → 清单 `base` 声明的基主题 → `seanblog-default` → 内置最小骨架。
- **partials**：注册顺序为 `seanblog-default` → `base` → 活跃主题，**后注册覆盖先注册**（活跃主题的 partial 胜出）。

因此你的主题可以只写要改的模板/partial，其余继承自 `base` 或默认主题。`base: seanblog-default` 是最常见的写法。

> 主题 slug 为 `seanblog-default` 视为内置默认主题，**禁止上传覆盖与删除**。

---

## 4. 清单 `theme.yaml`

清单是主题入口，YAML 格式。实际校验字段如下（见 `src/lib/theme.ts` 的 `validateManifest`）：

```yaml
slug: my-theme              # 必需，匹配 ^[a-z0-9][a-z0-9_-]{0,63}$，且须与目录名一致
name: My Theme              # 必需，展示名
version: 1.0.0              # 必需，语义版本字符串
author: { name: "...", url: "..." }   # 可选
description: "..."           # 可选
engine: seanblog-theme       # 必需，必须为字面量 seanblog-theme，否则拒绝安装
engineVersion: 2             # 必需，正整数；> 当前引擎版本(2) 则以"需要更新引擎"拒绝
previewImage: preview.png    # 可选，后台主题库展示图（相对包内路径）
base: seanblog-default       # 可选，缺失模板/partial 的继承基主题
assets:
  css: assets/theme.css      # 可选，主样式相对路径（缺省回退 assets/theme.css）
parts:                       # 可选，声明页面使用哪些平台 UI 块（控制 header/footer 显隐等）
  header: { blocks: [SiteHeader] }
  footer: { blocks: [SiteFooter] }
settingsSchema:              # 可选，设置 schema（见 §5）
  ...
settingsVersion: 1           # 可选，设置 schema 版本号（用于设置快照迁移，见 §12）
```

### 校验规则

- `slug`：必须匹配 `^[a-z0-9][a-z0-9_-]{0,63}$`，安装时须与目录名一致；不能是 `seanblog-default`。
- `engine`：必须等于 `seanblog-theme`，否则报 `UNSUPPORTED_THEME_ENGINE`。
- `engineVersion`：正整数；**大于当前引擎版本（2）会被拒绝**，等于或小于均可安装。
- 上传安装时：若 slug 已存在则报冲突；slug 为 `seanblog-default` 则禁止覆盖。

> ⚠️ 清单**没有** `templates`（模板列表）、`requires`（版本要求）、`screenshot`/`homepage`、`assets.js` 等字段。模板由 `templates/` 目录文件名决定，JS 由主题模板里 `{{asset "..."}}` 自行引用。

---

## 5. 设置 `settingsSchema`

后台 `/admin/themes` 的设置面板由 `theme.yaml.settingsSchema` 驱动。保存的值在读取时与 `theme.yaml` 默认值合并，注入模板 ctx 的 **`theme.config.*`**；声明了 `cssVariable` 的项会自动写入 `:root` 注入到 `<head>`。

### 5.1 结构与分组

支持 **1 层**（组 → 项数组）与 **2 层**（组 → 子组名 → 项数组）混用：

```yaml
settingsSchema:
  布局结构:                 # 2 层
    顶栏:
      - key: showTopBar
        type: boolean
      - key: headerBehavior
        if: "showTopBar === true"
    侧边栏:
      - key: sidebarPosition
      - key: sidebarSticky
        if: "sidebarPosition !== 'none'"
  页脚浮动:                 # 1 层
    - key: showBackToTop
      type: boolean
```

后台按层级渲染（组 h3 → 子组 h4 → 项）；空组、空子组自动隐藏。

### 5.2 字段定义

```yaml
- key: accent_color          # 设置 key，注入 theme.config.accent_color
  label: 强调色              # 后台表单标签
  type: color                # 见下表
  default: "#2563eb"         # 可选默认值（字符串/数字/布尔/数组）
  description: 可选说明      # 可选
  cssVariable: --color-accent   # 可选，值写入 :root 变量
  options:                    # select / multiselect 必填
    - { label: 深色, value: dark }
  itemFields:                 # list 专有：每行的子字段
    - { key: url, label: 链接, type: text }
  if: "sidebarPosition !== 'none'"   # 可选，条件显隐
  min: 0                      # range 专用
  max: 50
  step: 1
```

**支持类型**：

| type | 说明 | 值类型 |
|---|---|---|
| `text` | 单行文本 | string |
| `textarea` | 多行文本（适合 HTML 片段） | string |
| `color` | 颜色选择器 | string（如 `#2563eb`） |
| `number` | 数字 | number |
| `range` | 滑块，配 `min`/`max`/`step` | number |
| `boolean` | 开关 | boolean |
| `select` | 单选（需 `options`） | string |
| `multiselect` | 多选（需 `options`） | string[] |
| `list` | 多行条目，每行由 `itemFields` 组成（如导航项） | array |

### 5.3 条件显隐 `if`

FormKit/Halo 风格字符串表达式，**不使用 eval**（内置安全迷你求值器，见 `src/lib/theme/setting-condition.ts`）：

- 表达式为假时，该项后台不渲染，且**不参与本次保存**（服务端部分合并保留原值）。
- 运算符：`==` `!=` `===` `!==` `&&` `||` `!` `()`；字面量：字符串/数字/布尔/`null`/`undefined`。
- 标识符即其他设置 key（缺失视为 `undefined`）；支持点号取值 `obj.key`。
- 成员运算：`'x' in arr`（数组包含）、`'x' not in arr`、`'x' in str`（子串）——用于 multiselect 联动。
- **级联隐藏**：子项引用的父项若被隐藏，子项自动隐藏，无需重复根条件。
- 语法非法时该项仍显示并输出控制台警告（避免锁死设置）；循环依赖按可见处理并告警。

```yaml
- key: sidebarSticky
  if: "sidebarPosition !== 'none'"
- key: profileContent
  if: "'profile' in sidebarContent"   # sidebarContent 隐藏时本项自动隐藏
```

### 5.4 与模板的关系

设置值注入 `theme.config.*`（`theme.config` 即合并后的完整设置 map）。模板里这样用：

```hbs
<html data-theme="{{#eq theme.config.color_mode "light"}}light{{else}}dark{{/eq}}">
<style>:root { --accent: {{theme.config.accent_color}}; }</style>
{{#if theme.config.show_sidebar}}<aside>...</aside>{{/if}}
```

声明了 `cssVariable` 的项无需在模板里手写，平台会自动把 `:root { --var: value }` 并入 `{{{theme_css}}}`。

---

## 6. 模板系统

模板用 Handlebars 语法（`.hbs` 文件）。Handlebars 默认 `{{var}}` **HTML 转义**输出，`{{{var}}}` 不转义——这构成 XSS 防护的第一道线（见 [§14](#14-安全边界)）。

### 6.1 模板 fallback 链（重申）

页面模板查找顺序：活跃主题 → `base` → `seanblog-default` → 内置骨架。partials 注册顺序：`seanblog-default` → `base` → 活跃（后者覆盖前者）。你可以只写要改的模板。

### 6.2 布局（layout）注入机制

> ⚠️ **SeanBlog 不使用 Ghost 的 `{{!< default}}` 布局继承语法。** Handlebars 原生不支持该指令。

实际机制（见 `handlebars-engine.ts` 的 `renderTemplate`）：

1. 平台渲染页面模板（如 `index.hbs`）得到 HTML 片段 `bodyHtml`。
2. 调用布局模板 `default.hbs`，把 `{ ...ctx, body: bodyHtml }` 作为上下文传入。
3. `default.hbs` 用 **`{{{body}}}`** 注入页面内容。

因此：

- **页面模板**（`index.hbs`/`post.hbs` 等）只写页面主体，**不要**写 `<!DOCTYPE html>`/`<html>`/`<head>`。
- **`default.hbs`** 负责整页骨架，含 `<!DOCTYPE html>`、`<head>`、`<body>`，用 `{{{body}}}` 接收页面内容。

`default.hbs` 示例（取自默认主题，真实可用）：

```hbs
<!DOCTYPE html>
<html lang="{{site.locale}}" data-theme="{{#eq theme.config.color_mode "light"}}light{{else}}dark{{/eq}}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  {{{font_awesome}}}
  {{{seo_head}}}
  {{{theme_css}}}
  {{{callout_css}}}
  {{{katex_css_link}}}
</head>
<body class="sb-body sb-page-{{page}}">
  {{> header}}
  {{> search-dialog}}
  <main class="sb-main">{{{body}}}</main>
  {{> footer}}
  <script src="{{asset "assets/js/main.js"}}" defer></script>
  {{{platform_enhance}}}
</body>
</html>
```

> `{{{seo_head}}}`、`{{{theme_css}}}`、`{{{callout_css}}}`、`{{{katex_css_link}}}`、`{{{font_awesome}}}`、`{{{platform_enhance}}}` 都是平台预计算后注入 ctx 的**字符串字段**（不是 helper），用三花括号原样输出。见 [§8.2](#82-注入字段非-helper)。

### 6.3 Partials

`partials/*.hbs` 按文件名（去 `.hbs`）注册为短名 partial，用 `{{> name}}` 引用：

```hbs
{{> header}}
{{> post-card}}     {{!-- 可在 {{#each}} 内引用，自动以当前项为 this --}}
{{> pagination}}
```

partial fallback 同 [§6.1](#61-模板-fallback-链重申)。

---

## 7. 上下文（ctx）数据契约

每个页面的 ctx 由平台构建（`src/lib/theme/template-context.ts`）。**主题只消费 ctx，不接触数据源**。以下字段均与源码一致。

### 7.1 所有页面公共字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `page` | string | 页面标识：`home`/`post`/`taxonomy`/`categories`/`tags`/`search` |
| `site` | object | `{ title, description, url, locale, logo }`（站点设置） |
| `theme` | object | `{ slug, config }`；`config` 为合并后的完整设置 map（`theme.config.你的设置key`） |
| `settings` | object | 站点级设置 map（同 `theme.config`，历史别名） |
| `sidebarData` | object | `{ recentArticles[5], tags[50], categories[50] }`（侧栏数据，详见下） |
| `seo_head` | string | 注入 `<title>`/meta/OG/JSON-LD/canonical/RSS/sitemap（放 `<head>`） |
| `theme_css` | string | 主题 CSS + 设置 cssVariable + callout 合并包，包成 `<style>...</style>` |
| `callout_css` | string | Callout/Admonition 样式 `<style>...</style>`（已并入 theme_css，通常无需单独输出） |
| `katex_css_link` | string | KaTeX 数学公式样式 `<link>`（有公式时才非空） |
| `font_awesome` | string | Font Awesome 7 CDN `<link>`（带 integrity） |
| `platform_enhance` | string | 平台脚本 `<script src="/enhance.js" defer><script src="/analytics.js" defer>` |
| `seo` | object | 当前页 SEO 原始结构（一般不直接用，用 `seo_head` 即可） |

> 页脚 partial 约定：主题 `partials/footer.hbs` 应读取站点级 `settings.publicFooterText`（自定义页脚 HTML，非空时用 `{{{settings.publicFooterText}}}` 原样输出，否则回退主题默认版权）与 `settings.publicFooterShowRss`（布尔，默认 `true`，仅在显式为 `false` 时隐藏 RSS 入口）。页头导航/搜索/主题切换等属表现层，由 `theme.config.*` 控制，不再有站点级页头设置。

`sidebarData` 子结构：

```js
sidebarData: {
  recentArticles: [{ id, title, slug, publishedAt }],   // 最近 5 篇
  tags: [{ id, name, slug }],                           // 最多 50 个
  categories: [{ id, name, slug, count }],              // 最多 50 个，count=文章数
}
```

### 7.2 home（首页 `index.hbs`）

```js
{
  page: 'home',
  posts: [{ id, title, slug, excerpt, coverImage, isPinned, publishedAt, updatedAt,
            viewCount, commentCount, category, tags[], url }],   // 已发布文章，含置顶
  pinned: [...],          // 仅第 1 页且按发布时间排序时的置顶文章（结构同 posts）
  pagination: { page, pageCount, total, prevUrl, nextUrl, pages[{page,url,active}] },
  sort: 'publishedAt',    // 当前排序
  sortOptions: [{ value, label, href }],   // 排序切换链接
}
```

### 7.3 post（文章详情 `post.hbs`）

```js
{
  page: 'post',
  post: {
    id, title, slug, excerpt, coverImage,
    publishedAt, updatedAt, viewCount,
    category: { id, name, slug },
    tags: [{ id, name, slug, description }],
    readingMinutes, wordCount,
  },
  content: "<html>...正文...</html>",   // 已渲染的正文 HTML，用 {{{content}}} 不转义输出
  toc: [{ id, text, level }],            // 标题目录（h2-h4）
  navigation: { previous: {title,slug}|null, next: {...}|null },
  comments: [{                           // 已审核评论线程
    id, content, author, link, createdAt,
    replies: [{ id, content, author, link, createdAt, replyToAuthor }]
  }],
  commentsMode: 'enabled'|'readonly'|'disabled',
}
```

> `content` 是受 `rehype-sanitize` 净化的可信 HTML，必须用 `{{{content}}}` 原样输出。评论 `content`/`author`/`link` 是**不可信用户输入**，必须用 `{{content}}` 双花括号转义输出（见 [§14](#14-安全边界)）。

### 7.4 taxonomy（分类/标签归档 `taxonomy.hbs`）

```js
{
  page: 'taxonomy',
  taxonomy: { name, slug, description, type },   // type: 'category'|'tag'
  posts: [...],          // 结构同 home.posts
  pagination: {...},
}
```

### 7.5 categories / tags / search

```js
// categories.hbs
{ page: 'categories', categories: [...], pagination: {...} }   // listPublicCategories 原始项

// tags.hbs
{ page: 'tags', tags: [...], pagination: {...} }              // listPublicTags 原始项

// search.hbs
{ page: 'search', query: "搜索词", posts: [...], pagination: {...} }
```

---

## 8. Handlebars helpers 参考

平台内置白名单 helpers（**主题不能注册自己的 helper**）。完整列表见 `handlebars-engine.ts`。

### 8.1 helpers

| helper | 用法 | 说明 |
|---|---|---|
| `{{asset "assets/js/main.js"}}` | `asset path` | 主题资源 URL，重写为 `/api/themes/{slug}/asset?v={version}&path={path}`，带版本指纹防缓存 |
| `{{format_date publishedAt format="YYYY-MM-DD"}}` | `format_date date (hash: format)` | 日期格式化，占位符 `YYYY`/`MM`/`DD`/`HH`/`mm`；缺省 `YYYY-MM-DD`；非法日期返回空串 |
| `{{truncate post.excerpt length="120"}}` | `truncate text (hash: length)` | 去标签后截断，默认 200 字，末尾加 `…` |
| `{{t "Featured"}}` | `t key` | i18n 取词（当前内置词典为空，返回 key 本身） |
| `{{json obj}}` | `json obj` | 序列化为 JSON 并把 `"` 转义为 `&quot;`，返回 SafeString（防 XSS，用于把数据嵌入 `<script>` 或属性） |
| `{{#eq a b}}...{{else}}...{{/eq}}` | `eq a b (block)` | 相等则渲染 block，否则 inverse；无 block 时返回布尔 |
| `{{#ne a b}}...{{/ne}}` | `ne a b (block)` | 不等 |
| `{{#gt a b}}...{{/gt}}` | `gt a b (block)` | `Number(a) > Number(b)` |
| `{{#or a b}}...{{/or}}` | `or a b (block)` | `a || b` 为真 |
| `{{#not a}}...{{/not}}` | `not a (block)` | `!a` 为真 |
| `{{#limit arr 10}}...{{/limit}}` | `limit arr count (block)` | 只遍历前 `count` 项；提供 `{{@index}}`/`{{@first}}`/`{{@last}}` |

block helper 的 `{{else}}` 分支可选。示例：

```hbs
{{#eq pagination.page 1}}最新文章{{else}}第 {{pagination.page}} 页{{/eq}}
{{#ne commentsMode "disabled"}}<form data-sb-comment-form ...>...</form>{{/ne}}
{{#each sortOptions}}<a href="{{href}}" {{#eq value ../sort}}aria-current="true"{{/eq}}>{{label}}</a>{{/each}}
```

### 8.2 注入字段（非 helper）

以下用 `{{{...}}}` 输出的都是平台**预计算后注入 ctx 的字符串**，**不是 helper**，主题不能自定义它们：

- `{{{seo_head}}}` — SEO 头部
- `{{{theme_css}}}` — 主题样式合并包
- `{{{callout_css}}}` — Callout 样式
- `{{{katex_css_link}}}` — KaTeX 样式
- `{{{font_awesome}}}` — Font Awesome CDN
- `{{{platform_enhance}}}` — 平台脚本
- `{{{body}}}` — 布局注入的页面内容（仅 `default.hbs` 用）
- `{{{content}}}` — 文章正文 HTML（仅 `post.hbs` 用）

### 8.3 不存在的 helper（避免踩坑）

以下在架构文档里出现过，但**当前引擎未实现**，请勿使用：`{{#get}}`（受控取数）、`{{excerpt}}`、`{{img_url}}`、`{{reading_time}}`、`{{!< default}}`（Ghost 布局继承）。需要的数据已在 ctx 里提供；阅读时间用 `post.readingMinutes`。

---

## 9. 平台渐进增强契约（`data-sb-*`）

交互分两类，**务必区分**：

### 9.1 平台负责（`/enhance.js`，由 `{{{platform_enhance}}}` 注入）

主题放带 `data-sb-*` 属性的元素即可获得行为；**不挂也能静态展示，只是无交互**。

#### 评论提交

```hbs
<form data-sb-comment-form
      data-article-id="{{post.id}}"
      data-sb-comment-target="#sb-comments">   <!-- 可选：成功后滚回的锚点选择器 -->
  <input name="guestName" type="text">
  <input name="guestEmail" type="email">
  <input name="guestLink" type="url">
  <textarea name="content" required></textarea>
  <input type="hidden" name="parentId" value="">   <!-- 回复时由主题脚本填入 -->
  <button type="submit">发表评论</button>
  <p data-sb-comment-status></p>    <!-- 可选：状态提示位 -->
</form>
```

平台脚本行为：

- 拦截 submit → `POST /api/comments`（JSON，含同源守卫、限流、审核模式判断）。
- 提交中给 form 加 `data-state="submitting"`，成功且 `APPROVED` 加 `success`，待审核加 `pending`，失败加 `error`。用 CSS 响应：`[data-state="success"] { ... }`。
- 状态位 `[data-sb-comment-status]` 写中文提示文案。
- `APPROVED` 后约 900ms 刷新页面（让新评论显示），并按 `data-sb-comment-target` 跳锚。

字段名固定为 `content`/`guestName`/`guestEmail`/`guestLink`/`parentId`，表单 `data-article-id` 必填。`visitorId` 由平台按需处理，主题表单无需提供。

#### 搜索弹窗

弹窗 markup **由主题提供**，平台只接线 fetch + 填充。完整契约（缺项则对应功能缺失）：

```hbs
<div class="sb-search-overlay" data-sb-search-dialog hidden>
  <div class="sb-search-dialog">
    <input type="search" data-sb-search-input placeholder="搜索文章…" autocomplete="off">
    <ul class="sb-search-results" data-sb-search-results></ul>
    <template data-sb-search-result-template>
      <li><a data-sb-result-link><span data-sb-result-title></span></a></li>
    </template>
    <li class="sb-search-empty" data-sb-search-empty hidden>无结果</li>
  </div>
</div>

<!-- 触发按钮（放 header） -->
<button data-sb-search>搜索</button>
```

| 属性 | 元素 | 作用 |
|---|---|---|
| `data-sb-search` | 按钮 | 点击打开弹窗 |
| `data-sb-search-dialog` | 容器 | 弹窗根，点空白/Esc 关闭 |
| `data-sb-search-input` | `<input>` | 输入框，防抖 200ms 后 `GET /api/search?q=` |
| `data-sb-search-results` | `<ul>` | 结果容器 |
| `data-sb-search-result-template` | `<template>` | 单条结果模板（克隆填充） |
| `data-sb-result-link` | `<a>` | 结果链接，`href` 设为 `/articles/{slug}` |
| `data-sb-result-title` | `<span>` | 结果标题文本 |
| `data-sb-search-empty` | `<li>` | 无结果时显示 |

### 9.2 主题自实现（`assets/js/main.js`，参考默认主题）

以下交互**平台不接管**，由主题自带脚本实现（默认主题 `seanblog-default/assets/js/main.js` 是参考，可直接复制改造）：

| 行为 | 约定属性（默认主题采用，非平台强制） | 说明 |
|---|---|---|
| 深浅色切换 | `[data-sb-theme-toggle]` | 切换 `<html data-theme>` + 写 `sb-theme` cookie |
| 移动侧栏开合 | `[data-sb-sidebar-toggle target="#id"]` + 目标 `aside` | 切换 open class / `aria-expanded` |
| 目录滚动高亮 | `<nav data-sb-toc>` 内 `a[href="#id"]` | 滚动给当前项加标记 |
| 评论回复 | `[data-sb-reply-to="id"]`、`[data-sb-reply-author]`、`[data-sb-reply-banner]`、`[data-sb-reply-text]`、`[data-sb-reply-cancel]` | 点回复填 `parentId`、显示 banner、聚焦；取消恢复 |

> 这些属性名虽以 `data-sb-` 开头，但**纯属默认主题的内部约定**。第三方主题可以照搬（复制 `main.js`），也可以用完全不同的实现。唯一硬性要求是：评论表单的 `name="parentId"` 隐藏字段要能被你的回复脚本填值，平台提交时读取它。

---

## 10. CSS 规范

主题 CSS（清单 `assets.css` 指向的文件）受 `validateThemeCss`（`src/lib/validations/theme.ts`）校验，**安装时校验，运行时加载**。

### 10.1 允许与禁止

- **允许**：普通规则块、`@media` 查询（内部也只能是规则块）、规则内注释。
- **禁止**（命中即拒绝安装）：
  - `@import`、`!important`、`expression(`、`javascript:`、`behavior:`
  - 出现 `<` 或 `>`（防 HTML 注入）、`<style`/`</style`
  - 非 `@media` 的 `@` 规则（如 `@keyframes`、`@font-face`、`@layer`）
  - `!important` 声明
- **大小限制**：≤ 100KB（UTF-8 字节）。
- **至少一条声明**，否则报错。

### 10.2 `url()` 引用规则

CSS 里的 `url(...)` 只能引用**包内相对资源**，由平台重写为 `/api/themes/{slug}/asset?path=...`：

- 禁止 `http:`/`https:`/`data:`/`javascript:` 协议
- 禁止绝对路径 `/...`
- 禁止 `..`
- 相对路径基于 CSS 文件位置解析（如 `assets/css/x.css` 里 `url(../img/a.png)` → `/api/themes/{slug}/asset?path=assets/img/a.png`）

### 10.3 设置变量注入

声明了 `cssVariable` 的设置项，其值会被平台自动写入 `:root { --var: value }` 并并入 `{{{theme_css}}}`，无需在 CSS 里手写。例如设置项 `accent_color` 配 `cssVariable: --color-accent`，CSS 直接 `color: var(--color-accent)` 即可。

### 10.4 后台自定义 Callout CSS

后台「Callout 样式」是站点级设置（非主题包内文件），经 `/api/admin/validate-css` 用类似但略宽的规则校验（允许 `@import`? 否——同样禁 `!important` 等）。主题如需默认 callout 样式，放在 `theme.css` 里，平台会通过 `{{{theme_css}}}` 一并输出。

---

## 11. 资源与 `asset` helper

主题包内资源（js/css/img/字体等）通过 `{{asset "相对路径"}}` 引用，平台重写为带版本指纹的资源路由：

```hbs
<link rel="stylesheet" href="{{asset "assets/theme.css"}}">
<script src="{{asset "assets/js/main.js"}}" defer></script>
<img src="{{asset "assets/img/logo.png"}}">
```

生成形如 `/api/themes/{slug}/asset?v={version}&path={encoded}`，`Cache-Control: public, max-age=31536000, immutable` + `X-Content-Type-Options: nosniff`。

资源路由按扩展名返回 Content-Type（`.css`/`.js`/`.svg`/`.png`/`.jpg`/`.webp`/`.woff2` 等，其余 `application/octet-stream`）。路径经 `resolveThemePath` 校验，**禁止 `..` 与绝对路径**（防穿越）。

> 不用 `{{asset}}` 而直接写 `/assets/...` 绝对路径**不会**工作——主题包不在 Next 的 `public/` 下，必须走资源路由。

---

## 12. 设置快照：导出与导入

### 12.1 导出

后台导出主题 zip 时，平台会把当前主题的**全量有效设置**（合并默认值后过滤未知字段）写入 zip 根目录的 `theme-settings.json`，格式：

```json
{
  "formatVersion": 1,
  "theme": { "slug": "my-theme", "version": "1.0.0" },
  "settingsVersion": 1,
  "settingsSchemaHash": "sha256:...",
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "settings": {}
}
```

### 12.2 导入

导入 zip 时 `theme-settings.json` 为**可选**文件。后台支持三种 `settingsMode`：

- `ignore`：只装主题文件，忽略快照。
- `preserve`（默认）：当前主题已有设置则保留，没有才应用快照。
- `restore`：应用快照并覆盖当前设置。

导入时会校验：格式版本、主题 slug、设置版本、schema hash、字段类型、select/multiselect 选项、range 范围、list 子字段、`calloutCustomCss`。schema 新增字段不写库（用默认值），未知字段忽略并告警。

### 12.3 设置版本迁移

主题清单可声明 `settingsVersion`（不声明按 v1）。快照版本低于当前时，由应用内注册的迁移函数逐版本迁移；**不执行主题包内任何脚本**。没有迁移规则或快照版本更高时拒绝应用。主题作者在升级设置结构时，需在新版本声明更高的 `settingsVersion` 并（由平台侧）补充迁移规则。

---

## 13. 上传 / 启用 / 预览 / 卸载

### 13.1 上传（zip）

后台 `/admin/themes` 上传 `.zip`，服务端依次：

1. zip 安全校验：Zip-Slip、压缩炸弹、文件数（≤200）、大小（≤2MB 压缩 / ≤20MB 解压 / 单文件 ≤2MB）。
2. 解析 `theme.yaml`：字段、引擎、版本校验。
3. Handlebars **预编译校验**：每个 `templates/*.hbs` 与 `partials/*.hbs` 用 `Handlebars.compile` 解析，语法错误则拒绝。
4. CSS 校验（§10）。
5. 解压到 `themes/{slug}/`，失败回滚（删目录）。
6. （可选）应用 `theme-settings.json`（§12）。

> **不构建任何 JS**——主题无服务端代码。`assets/js/main.js` 作为静态资源由资源路由返回。

### 13.2 启用

写站点设置 `activeTheme = slug` 并清缓存，**即时生效，无需重启**。

### 13.3 预览

`/theme-preview?theme=<slug>&page=home|article`（管理员会话保护），真实渲染目标主题，与前台唯一区别是路由在管理员会话下可见。

### 13.4 卸载

非默认、非当前活跃主题可删；删除 `themes/{slug}/` 目录并清模板/设置缓存，同步删除其 `ThemeCustomization` 记录。

---

## 14. 安全边界

主题运行在沙箱内，以下红线由平台强制：

1. **模板沙箱**：Handlebars 自动转义 `{{var}}`；helpers 白名单；**主题不能注册 helper、不能 `require` 任何模块** → 无法执行服务端代码。
2. **不可信数据必须双花括号**：评论 `content`/`author`/`link`、搜索词 `query`、访客输入等必须用 `{{...}}` 转义输出。**严禁**对这些字段用 `{{{...}}}`，否则存储型 XSS。文章正文 `content` 是净化后的可信 HTML，用 `{{{content}}}`。
3. **`{{json x}}` helper**：序列化对象时转义引号，用于把数据安全嵌入 `<script>` 或属性。
4. **资源沙箱**：`{{asset}}` 仅允许相对路径，重写到资源路由；CSS 禁危险构造（§10）。
5. **zip 沙箱**：路径穿越/超大/压缩炸弹/非法类型拦截。
6. **平台脚本不可篡改**：`{{{platform_enhance}}}` 由平台构建期打包，主题只能通过 `data-*` 传数据，不能注入脚本、不能改 fetch 目标。评论/搜索走平台预置的同源守卫与限流。
7. **CSP**：前台有 `Content-Security-Policy`，`script-src` 不允许内联（除平台受控脚本），主题不要尝试内联 `<script>` 内容（`<script src=...>` 引用自己的 `.js` 是允许的）。

---

## 15. 完整最小主题示例

一个可上传运行的最小主题（仅首页 + 文章页 + 布局 + 样式，不含设置与 partial）：

`theme.yaml`：

```yaml
slug: my-minimal
name: My Minimal
version: 1.0.0
engine: seanblog-theme
engineVersion: 2
base: seanblog-default
assets:
  css: assets/theme.css
```

`templates/default.hbs`：

```hbs
<!DOCTYPE html>
<html lang="{{site.locale}}" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  {{{font_awesome}}}
  {{{seo_head}}}
  {{{theme_css}}}
  {{{katex_css_link}}}
</head>
<body class="page-{{page}}">
  <header class="site-head">
    <a href="/">{{site.title}}</a>
    <button data-sb-search>搜索</button>
  </header>
  <main>{{{body}}}</main>
  {{{platform_enhance}}}
</body>
</html>
```

`templates/index.hbs`：

```hbs
<h1>{{site.title}}</h1>
{{#if posts.length}}
  <ul>
    {{#each posts}}
      <li><a href="{{url}}">{{title}}</a> <small>{{format_date publishedAt}}</small></li>
    {{/each}}
  </ul>
  {{> pagination}}   {{!-- 继承自 seanblog-default --}}
{{else}}
  <p>暂无文章</p>
{{/if}}
```

`templates/post.hbs`：

```hbs
<article>
  <h1>{{post.title}}</h1>
  <p class="meta">{{format_date post.publishedAt}} · {{post.viewCount}} 浏览</p>
  <div class="content">{{{content}}}</div>

  {{#if toc.length}}
    <nav data-sb-toc>
      {{#each toc}}<a href="#{{id}}">{{text}}</a>{{/each}}
    </nav>
  {{/if}}

  {{#if navigation.previous}}<a href="/articles/{{navigation.previous.slug}}">← {{navigation.previous.title}}</a>{{/if}}

  <section id="sb-comments">
    <h2>{{comments.length}} 条评论</h2>
    {{#each comments}}
      <article>
        <p>{{author}} · {{format_date createdAt}}</p>
        <div>{{content}}</div>
        {{#each replies}}
          <div class="reply">{{#if replyToAuthor}}<span>@{{replyToAuthor}}</span>{{/if}}{{content}}</div>
        {{/each}}
      </article>
    {{/each}}

    {{#ne commentsMode "disabled"}}
    <form data-sb-comment-form data-article-id="{{post.id}}" data-sb-comment-target="#sb-comments">
      <input name="guestName" type="text" placeholder="昵称">
      <textarea name="content" required></textarea>
      <input type="hidden" name="parentId" value="">
      <button type="submit">发表</button>
      <p data-sb-comment-status></p>
    </form>
    {{/ne}}
  </section>
</article>
```

`assets/theme.css`：

```css
body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; }
.site-head { display: flex; justify-content: space-between; align-items: center; }
.content :is(h2, h3) { margin-top: 2em; }
[data-sb-comment-form][data-state="success"] { border: 2px solid green; }
[data-sb-comment-form][data-state="error"] { border: 2px solid red; }
```

打包：在 `my-minimal/` 目录里 `zip -r ../my-minimal.zip .`，上传到后台即可。

---

## 16. 调试与常见坑

- **改了模板没生效**：生产模式模板有缓存，需在后台重新启用主题或重启；开发模式每次重读磁盘。
- **`{{!< default}}` 报错或无效**：本引擎不支持 Ghost 布局继承，用 `{{{body}}}`（见 §6.2）。
- **`{{asset}}` 路径 404**：路径相对主题包根，如 `assets/js/main.js`，不能以 `/` 开头。
- **CSS 装不上**：检查是否含 `@import`/`!important`/`@keyframes`/`<`/`>`，或超 100KB（见 §10）。
- **`{{{...}}}` vs `{{...}}` 搞混**：用户输入（评论/搜索词）必须双花括号；可信 HTML（正文/平台注入字段）用三花括号。
- **设置不生效**：确认 `theme.yaml.settingsSchema` 字段 `key` 与模板里 `theme.config.xxx` 一致；声明了 `cssVariable` 的项平台自动注入，CSS 用 `var(--xxx)`。
- **partials 不覆盖**：partials fallback 是"活跃覆盖默认"，你的 `partials/header.hbs` 会覆盖 `seanblog-default` 的同名 partial。
- **预览与前台不一致**：预览走相同渲染路径，差异通常来自站点设置（如 `siteUrl`）在管理员会话下的取值；以 `/theme-preview` 为准上线前验证。
- **想取额外数据（如侧栏最新文章）**：已由 `sidebarData` 提供（§7.1）；`{{#get}}` 未实现，不要尝试。
