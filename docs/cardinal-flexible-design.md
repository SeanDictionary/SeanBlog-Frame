# Cardinal 主题高自由度设计方案

> 目标：一个主题，通过设置项切换出所有博客布局风格（Aurora0x27 / DexterJie / Lazzaro / Yo1o），同时可调视觉风格。
>
> 文章列表始终纵向排列，不支持横向滚动。

---

## 一、设置项总览

### 布局结构设置

| Key | 标签 | 类型 | 选项 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `sidebarPosition` | 侧边栏位置 | select | `none` / `left` / `right` / `both` | `right` | 控制侧边栏出现位置，`both`=左右各一个 |
| `showTopBar` | 顶部栏 | boolean | — | `true` | 是否显示 sticky 顶部导航栏 |
| `articleListStyle` | 文章列表样式 | select | `list` / `cards` | `list` | 文字列表（纵向） / 卡片网格（纵向） |
| `showHeroSection` | 首页 Hero 区 | boolean | — | `true` | 首页是否显示品牌/介绍区 |
| `showFeaturedSection` | 精选文章区 | boolean | — | `false` | 首页是否拆分精选置顶+最新文章 |
| `contentWidth` | 内容宽度 | select | `narrow` / `medium` / `wide` | `medium` | narrow≈30rem, medium≈42rem, wide≈64rem |
| `sidebarSticky` | 侧边栏固定方式 | select | `static` / `sticky` / `fixed` | `sticky` | Lazzaro=fixed, DexterJie=sticky, 普通=static |
| `sidebarContent` | 侧边栏内容 | multiselect | `profile` / `recent` / `tags` / `categories` / `toc` | `profile,recent,tags` | 控制侧边栏显示哪些区块，顺序即渲染顺序 |

### 视觉风格设置

| Key | 标签 | 类型 | 选项 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `fontFamily` | 正文字体 | select | `monospace` / `sans` / `serif` | `monospace` | 全局字体族 |
| `headingFontFamily` | 标题字体 | select | `same` / `monospace` / `sans` / `serif` | `same` | 标题字体，`same`=跟随正文 |
| `accentColor` | 强调色 | color | — | `#cf829e` | 链接、悬停、强调色 |
| `colorMode` | 色彩模式 | select | `dark` / `light` / `auto` | `dark` | 深色/浅色/跟随系统 |
| `showThemeToggle` | 前台色彩切换按钮 | boolean | — | `true` | 是否在顶部栏/浮动按钮区显示深浅色切换按钮，由用户自行决定是否展示 |
| `borderRadius` | 圆角大小 | select | `none` / `small` / `medium` / `large` | `small` | none=0, small=0.25rem, medium=0.5rem, large=1rem |
| `showShadow` | 阴影效果 | boolean | — | `false` | 卡片/面板是否使用 box-shadow |
| `listSeparator` | 列表分隔方式 | select | `border` / `gap` / `card` | `border` | border=底线分隔, gap=间距, card=卡片包裹 |

---

## 二、CSS 变量映射

### 布局变量

```css
:root {
  /* 由 sidebarPosition 控制 */
  --layout-sidebar-left-width: 0rem;      /* none=0, left/both=15rem */
  --layout-sidebar-right-width: 0rem;     /* none=0, right/both=15rem */
  --layout-sidebar-position: static;      /* static / sticky / fixed */

  /* 由 contentWidth 控制 */
  --layout-content-max-width: 42rem;      /* narrow=30rem, medium=42rem, wide=64rem */

  /* 由 showTopBar 控制 */
  --layout-header-height: 3.5rem;         /* showTopBar=true 时生效 */

  /* 由 borderRadius 控制 */
  --radius-sm: 0;       /* none */
  --radius: 0.25rem;    /* small */
  --radius-lg: 0.5rem;  /* medium */
  --radius-xl: 1rem;    /* large */
}
```

### 字体变量

```css
:root {
  /* 由 fontFamily 控制 */
  --font-sans: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;  /* monospace */
  /* 或 */
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;   /* sans */
  /* 或 */
  --font-sans: Georgia, "Noto Serif SC", "Songti SC", serif;                      /* serif */

  /* 由 headingFontFamily 控制 */
  --font-heading: var(--font-sans);  /* same 时跟随正文 */
}
```

### 色彩变量

```css
:root {
  /* 由 accentColor 控制 */
  --color-accent: #cf829e;
  --color-accent-hover: color-mix(in srgb, var(--color-accent) 80%, white);

  /* 由 colorMode=dark 控制 */
  --color-bg: #21273b;
  --color-text: #eaedf3;
  --color-border: #3d4468;
  --color-muted-bg: rgba(0, 0, 0, 0.2);

  /* 由 colorMode=light 控制 */
  --color-bg: #fafcfc;
  --color-text: #222e36;
  --color-border: #e3a9c6;
  --color-muted-bg: rgba(0, 0, 0, 0.05);
}
```

### 圆角变量

```
borderRadius=none:   --radius-sm: 0        --radius: 0        --radius-lg: 0
borderRadius=small:  --radius-sm: 0.125rem --radius: 0.25rem  --radius-lg: 0.5rem
borderRadius=medium: --radius-sm: 0.25rem  --radius: 0.5rem   --radius-lg: 0.75rem
borderRadius=large:   --radius-sm: 0.5rem   --radius: 1rem      --radius-lg: 1.5rem
```

### 阴影变量

```
showShadow=false: --shadow-card: none
showShadow=true:  --shadow-card: 0 2px 8px rgba(0,0,0,0.08)
```

---

## 三、页面条件分支

### 3.1 首页 (home.tsx)

```
HomePage 组件逻辑：

1. 读取 settings:
   - sidebarPosition, showTopBar, articleListStyle
   - showHeroSection, showFeaturedSection
   - contentWidth, sidebarSticky, sidebarContent
   - listSeparator, showThemeToggle

2. 布局结构：
   ┌─ TopBar (if showTopBar) ──────────────────────┐
   │ [Brand]        [Nav]       [ThemeToggle?]     │
   ├─ SidebarLeft (if sidebarPosition=left|both) ──┤
   │ ┌─ Main Content ──────────┐ ┌─ SidebarRight ┐│
   │ │                          │ │               ││
   │ │ [Hero (if showHero)]     │ │ [Profile]     ││
   │ │                          │ │ [Recent]      ││
   │ │ [Featured (if enabled)]  │ │ [Tags]        ││
   │ │  • 置顶文章列表          │ │ [Categories]  ││
   │ │                          │ │               ││
   │ │ [ArticleList]            │ │ (sticky/fixed)││
   │ │  style=list:             │ └───────────────┘│
   │ │    border-bottom 分隔     │                  │
   │ │  style=cards:             │                  │
   │ │    grid 2-3列卡片          │                  │
   │ │                          │                  │
   │ │ [Pagination]             │                  │
   │ └──────────────────────────┘                  │
   ├──────────────────────────────────────────────┤
   │ Footer                                         │
   └──────────────────────────────────────────────┘

3. 条件分支详情：

   IF showTopBar:
     渲染 <header class="sb-site-header sticky">
       Brand + Nav + (ThemeToggle if showThemeToggle)
     </header>
   ELSE:
     Brand + Nav 移入 SidebarLeft 顶部（DexterJie 模式）
     IF sidebarPosition=none AND !showTopBar:
       Brand + Nav 渲染在 Main 顶部（内联模式）

   IF showHeroSection:
     渲染 Hero 区:
       - 站点名（大字号）
       - 站点描述
       - 社交链接
     Hero 区在 Main 内容顶部，全宽

   IF showFeaturedSection:
     拆分文章：
       featured = articles.filter(isPinned)
       recent = articles.filter(!isPinned)
     渲染两个列表区块，各有标题
   ELSE:
     单一列表渲染所有文章

   SWITCH articleListStyle:
     CASE "list":
       <div class="divide-y">
         每篇文章：标题 + 日期 + 摘要 + 标签
         border-bottom 分隔（listSeparator=border）
         或 gap 间距（listSeparator=gap）
         或卡片包裹（listSeparator=card）
       </div>

     CASE "cards":
       <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         每篇文章：卡片
           - 封面图
           - 标题
           - 摘要
           - 日期 + 标签
         卡片有 border + radius + shadow(if showShadow)
       </div>

   IF sidebarPosition != none:
     渲染侧边栏（左/右/两侧）
     侧边栏内容由 sidebarContent multiselect 控制
     侧边栏定位由 sidebarSticky 控制：
       static: 跟随内容流
       sticky: position:sticky, top:计算值
       fixed: position:fixed, 全高，内容区独立滚动（Lazzaro 模式）
```

### 3.2 文章详情页 (article-detail.tsx)

```
ArticleDetailPage 组件逻辑：

1. 布局结构：
   IF sidebarPosition != none:
     ┌─ Main Content ─────────┐ ┌─ Sidebar ┐┐
     │ Article Header          │ │ TOC      ││
     │   标题 + 元信息          │ │          ││
     │   封面图                │ │ (sticky) ││
     │ Article Body            │ │          ││
     │   <ArticleContent>      │ └──────────┘│
     │ Article Navigation      │              │
     │   上一篇 / 下一篇        │              │
     │ Comments                │              │
     └─────────────────────────┘              │

   IF sidebarPosition = none:
     单列居中
     Article Header (max-width: contentWidth)
     Article Body (max-width: contentWidth)
     Article Navigation
     Comments

2. 条件分支：

   IF sidebarContent 包含 "toc":
     侧边栏渲染 TOC（文章标题大纲）
     TOC 是 sticky 的，滚动时高亮当前章节
   ELSE:
     侧边栏渲染其他内容（profile/recent/tags）

   IF sidebarPosition = none:
     TOC 不显示（或渲染在文章末尾折叠）

   IF sidebarSticky = fixed:
     整个页面三列布局（Lazzaro 模式）
     左侧栏 fixed + 右侧栏 fixed + 中间独立滚动
     文章内容在中间列滚动
```

### 3.3 分类/标签列表页 (taxonomy.tsx)

```
TaxonomyPage 逻辑：

1. 布局与首页一致（侧边栏 + 内容宽度等设置生效）

2. 文章列表样式跟随 articleListStyle 设置：
   list: border-bottom 分隔
   cards: 卡片网格

3. 顶部显示分类/标签信息：
   - 分类名/标签名（H1）
   - 描述
   - 文章计数
```

### 3.4 分类/标签索引页 (categories-index.tsx / tags-index.tsx)

```
IndexPage 逻辑：

1. 布局与首页一致

2. 分类列表样式：
   IF articleListStyle = cards:
     卡片网格，每个分类一张卡片，显示名称 + 文章数 + 描述
   ELSE:
     列表行，每行一个分类，名称 + 文章数

3. 标签列表样式：
   固定为标签云（flex-wrap，每个标签一个 pill），不受 articleListStyle 影响
```

### 3.5 搜索页 (search.tsx)

```
SearchPage 逻辑：

1. 布局与首页一致

2. 搜索结果列表样式跟随 articleListStyle
3. 顶部显示搜索关键词 + 结果数
```

---

## 四、设置组合参考

以下组合展示了不同博客风格的设置值，供参考（不提供一键预设按钮，用户手动调整）：

### 参考组合 A：Aurora0x27 风

```json
{
  "sidebarPosition": "none",
  "showTopBar": true,
  "articleListStyle": "list",
  "showHeroSection": true,
  "showFeaturedSection": true,
  "contentWidth": "narrow",
  "sidebarSticky": "static",
  "fontFamily": "monospace",
  "accentColor": "#cf829e",
  "colorMode": "dark",
  "showThemeToggle": true,
  "borderRadius": "small",
  "showShadow": false,
  "listSeparator": "border"
}
```

### 参考组合 B：DexterJie 风

```json
{
  "sidebarPosition": "left",
  "showTopBar": false,
  "articleListStyle": "list",
  "showHeroSection": false,
  "showFeaturedSection": false,
  "contentWidth": "medium",
  "sidebarSticky": "sticky",
  "sidebarContent": ["profile", "recent"],
  "fontFamily": "sans",
  "accentColor": "#ff7a7a",
  "colorMode": "light",
  "showThemeToggle": false,
  "borderRadius": "none",
  "showShadow": true,
  "listSeparator": "gap"
}
```

### 参考组合 C：Lazzaro 风

```json
{
  "sidebarPosition": "both",
  "showTopBar": false,
  "articleListStyle": "list",
  "showHeroSection": false,
  "showFeaturedSection": false,
  "contentWidth": "medium",
  "sidebarSticky": "fixed",
  "sidebarContent": ["categories", "tags"],
  "fontFamily": "sans",
  "accentColor": "#333333",
  "colorMode": "light",
  "showThemeToggle": false,
  "borderRadius": "none",
  "showShadow": false,
  "listSeparator": "border"
}
```

### 参考组合 D：Yo1o 风

```json
{
  "sidebarPosition": "none",
  "showTopBar": true,
  "articleListStyle": "list",
  "showHeroSection": true,
  "showFeaturedSection": false,
  "contentWidth": "wide",
  "sidebarSticky": "static",
  "fontFamily": "sans",
  "accentColor": "#0f172a",
  "colorMode": "light",
  "showThemeToggle": false,
  "borderRadius": "large",
  "showShadow": false,
  "listSeparator": "card"
}
```

### 参考组合 E：现代卡片风

```json
{
  "sidebarPosition": "right",
  "showTopBar": true,
  "articleListStyle": "cards",
  "showHeroSection": false,
  "showFeaturedSection": false,
  "contentWidth": "wide",
  "sidebarSticky": "sticky",
  "sidebarContent": ["profile", "recent", "tags"],
  "fontFamily": "sans",
  "accentColor": "#3b82f6",
  "colorMode": "auto",
  "showThemeToggle": true,
  "borderRadius": "medium",
  "showShadow": true,
  "listSeparator": "card"
}
```

---

## 五、边界情况与约束

### 5.1 布局冲突

| 场景 | 处理 |
|---|---|
| `sidebarPosition=none` + `showTopBar=false` | Brand+Nav 渲染在 Main 顶部内联 |
| `sidebarPosition=both` + `contentWidth=wide` | 三列+宽内容会溢出，contentWidth 降级为 medium |
| `sidebarPosition=both` + `sidebarSticky=fixed` | Lazzaro 模式：左右 fixed，中间独立滚动 |
| `sidebarPosition=left` + `sidebarSticky=fixed` | 左侧 fixed，右侧内容正常滚动 |
| `articleListStyle=cards` + `listSeparator=border` | cards 忽略 listSeparator，用 gap 分隔 |
| `sidebarContent` 包含 `toc` 但不在文章详情页 | toc 自动隐藏，显示其他区块 |
| `showThemeToggle=true` + `showTopBar=false` | 切换按钮改为右下角浮动按钮（参考 seandictionary.top） |

### 5.2 响应式行为

| 屏幕宽度 | 行为 |
|---|---|
| ≥1024px (lg) | 完整布局，侧边栏/三列/卡片网格 3列 |
| 768-1023px (md) | 侧边栏改为抽屉式（汉堡触发），卡片网格 2列 |
| <768px (sm) | 单列，侧边栏改为抽屉式（汉堡触发），卡片网格 1列，TopBar 缩为汉堡菜单 |

### 5.2.1 移动端侧边栏抽屉（参考 seandictionary.top）

移动端（<1024px）侧边栏不在页面内渲染，改为**滑入式抽屉**：

```
默认状态（抽屉隐藏）：
┌───────────────────┐
│ [☰]  Brand  [🎨] │  ← 顶部栏，左侧汉堡按钮
├───────────────────┤
│                   │
│   Main Content    │  ← 全宽内容
│                   │
└───────────────────┘

抽屉打开状态：
┌──────────┬────────┐
│ Overlay  │ Side-  │
│ (半透明) │ bar    │
│          │ 内容   │
│ click →  │ 自带   │
│ 关闭     │ 滚动   │
│          │        │
└──────────┴────────┘
```

**实现要点**：
- 侧边栏 `position:fixed`，默认 `transform:translateX(-100%)` 藏在屏幕外
- 汉堡按钮点击后，侧边栏 `transform:translateX(0)` 滑入
- 同时渲染半透明遮罩 `position:fixed, inset:0, bg:rgba(0,0,0,0.5)`
- 点击遮罩或关闭按钮收起抽屉
- 抽屉内容独立滚动（`overflow:auto`）
- 抽屉宽度固定 280px（参考 seandictionary.top）
- 仅当 `sidebarPosition != none` 时显示汉堡按钮

### 5.3 色彩模式实现

采用**运行时切换**方案（data-theme 属性 + cookie）：

1. 主题 CSS 用 `[data-theme="dark"]` 和 `[data-theme="light"]` 两套变量
2. layout.tsx 读取 cookie `sb-theme` 值，设置 `<html data-theme="...">`
3. TopBar 的 ThemeToggle 按钮切换 cookie + 重新加载（或客户端动态切换）
4. `colorMode` 设置决定默认行为：
   - `dark`: 默认 `data-theme="dark"`
   - `light`: 默认 `data-theme="light"`
   - `auto`: 无 cookie 时跟随 `prefers-color-scheme`，有 cookie 时跟随 cookie

CSS 代码结构：
```css
/* 基础变量 */
:root {
  --color-accent: #cf829e;
  /* ... */
}

/* 深色模式 */
[data-theme="dark"] {
  --color-bg: #21273b;
  --color-text: #eaedf3;
  --color-border: #3d4468;
  --color-muted-bg: rgba(0, 0, 0, 0.2);
}

/* 浅色模式 */
[data-theme="light"] {
  --color-bg: #fafcfc;
  --color-text: #222e36;
  --color-border: #e3a9c6;
  --color-muted-bg: rgba(0, 0, 0, 0.05);
}

/* colorMode=auto 时的默认值（无 cookie 时） */
:root {
  --color-bg: #fafcfc;
  --color-text: #222e36;
  /* ...浅色为默认... */
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --color-bg: #21273b;
    --color-text: #eaedf3;
    /* ... */
  }
}
```

**ThemeToggle 按钮**：
- 仅当 `showThemeToggle=true` 时渲染
- `showTopBar=true`：按钮在顶部栏右侧
- `showTopBar=false`：按钮在右下角浮动（参考 seandictionary.top 的 fabtn）
- 点击逻辑：读取当前 `data-theme`，切换为相反值，写入 cookie，更新 `<html>` 属性

### 5.4 侧边栏内容渲染

`sidebarContent` 是 multiselect，顺序就是渲染顺序。

| 值 | 渲染内容 | 数据来源 |
|---|---|---|
| `profile` | 站点名 + 描述 + 头像 | settings.siteName, settings.siteDescription |
| `recent` | 最近5篇文章标题列表 | listPublicArticles({pageSize:5}) |
| `tags` | 标签云（flex-wrap pills） | listPublicTags({pageSize:20}) |
| `categories` | 分类列表（带文章数） | listPublicCategories() |
| `toc` | 文章标题大纲（仅详情页） | article.toc |

---

## 六、settingsSchema 定义

```json
{
  "settingsSchema": [
    {
      "key": "sidebarPosition",
      "label": "侧边栏位置",
      "type": "select",
      "options": [
        { "value": "none", "label": "无侧边栏" },
        { "value": "left", "label": "左侧" },
        { "value": "right", "label": "右侧" },
        { "value": "both", "label": "双侧" }
      ],
      "default": "right"
    },
    {
      "key": "showTopBar",
      "label": "显示顶部栏",
      "type": "boolean",
      "default": true
    },
    {
      "key": "articleListStyle",
      "label": "文章列表样式",
      "type": "select",
      "options": [
        { "value": "list", "label": "文字列表" },
        { "value": "cards", "label": "卡片网格" }
      ],
      "default": "list"
    },
    {
      "key": "showHeroSection",
      "label": "首页 Hero 区",
      "type": "boolean",
      "default": true
    },
    {
      "key": "showFeaturedSection",
      "label": "精选文章区",
      "type": "boolean",
      "default": false
    },
    {
      "key": "contentWidth",
      "label": "内容宽度",
      "type": "select",
      "options": [
        { "value": "narrow", "label": "窄 (30rem)" },
        { "value": "medium", "label": "中 (42rem)" },
        { "value": "wide", "label": "宽 (64rem)" }
      ],
      "default": "medium"
    },
    {
      "key": "sidebarSticky",
      "label": "侧边栏固定",
      "type": "select",
      "options": [
        { "value": "static", "label": "不固定" },
        { "value": "sticky", "label": "滚动吸顶" },
        { "value": "fixed", "label": "全屏固定" }
      ],
      "default": "sticky"
    },
    {
      "key": "sidebarContent",
      "label": "侧边栏内容",
      "type": "multiselect",
      "options": [
        { "value": "profile", "label": "个人简介" },
        { "value": "recent", "label": "最近文章" },
        { "value": "tags", "label": "标签云" },
        { "value": "categories", "label": "分类列表" },
        { "value": "toc", "label": "文章目录" }
      ],
      "default": ["profile", "recent", "tags"]
    },
    {
      "key": "fontFamily",
      "label": "正文字体",
      "type": "select",
      "options": [
        { "value": "monospace", "label": "等宽 (Monospace)" },
        { "value": "sans", "label": "无衬线 (Sans)" },
        { "value": "serif", "label": "衬线 (Serif)" }
      ],
      "default": "monospace"
    },
    {
      "key": "headingFontFamily",
      "label": "标题字体",
      "type": "select",
      "options": [
        { "value": "same", "label": "跟随正文" },
        { "value": "monospace", "label": "等宽" },
        { "value": "sans", "label": "无衬线" },
        { "value": "serif", "label": "衬线" }
      ],
      "default": "same"
    },
    {
      "key": "accentColor",
      "label": "强调色",
      "type": "color",
      "default": "#cf829e",
      "cssVariable": "--color-accent"
    },
    {
      "key": "colorMode",
      "label": "色彩模式",
      "type": "select",
      "options": [
        { "value": "dark", "label": "深色" },
        { "value": "light", "label": "浅色" },
        { "value": "auto", "label": "跟随系统" }
      ],
      "default": "dark"
    },
    {
      "key": "showThemeToggle",
      "label": "前台色彩切换按钮",
      "type": "boolean",
      "default": true
    },
    {
      "key": "borderRadius",
      "label": "圆角大小",
      "type": "select",
      "options": [
        { "value": "none", "label": "无圆角" },
        { "value": "small", "label": "小" },
        { "value": "medium", "label": "中" },
        { "value": "large", "label": "大" }
      ],
      "default": "small"
    },
    {
      "key": "showShadow",
      "label": "阴影效果",
      "type": "boolean",
      "default": false
    },
    {
      "key": "listSeparator",
      "label": "列表分隔方式",
      "type": "select",
      "options": [
        { "value": "border", "label": "底线分隔" },
        { "value": "gap", "label": "间距分隔" },
        { "value": "card", "label": "卡片包裹" }
      ],
      "default": "border"
    }
  ]
}
```

---

## 七、实现优先级

| 阶段 | 内容 | 涉及文件 |
|---|---|---|
| **P1** | settingsSchema 定义 + CSS 变量映射 | theme.json + theme.css |
| **P2** | home.tsx 条件布局（侧边栏 + TopBar + Hero + 列表样式） | themes/cardinal/pages/home.tsx |
| **P3** | article-detail.tsx 条件布局（侧边栏 + TOC + 内容宽度） | themes/cardinal/pages/article-detail.tsx |
| **P4** | taxonomy / categories-index / tags-index / search | 其余 4 个页面文件 |
| **P5** | 移动端抽屉 + 运行时色彩切换（ThemeToggle + cookie） | layout.tsx + 客户端组件 |
| **P6** | 管理界面设置项渲染 | themes-manager.tsx |
