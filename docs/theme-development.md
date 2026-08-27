# 主题包开发指南

SeanBlog 主题是**可执行主题包**：主题用 `pages/*.tsx`（React 组件）全权决定前台页面的布局、样式与组件组合，同时通过 `settingsSchema` 暴露丰富的自定义设置。框架负责数据获取、组件注入与安全编译，主题只消费注入的 `data` 与 `data.components`。

## 渲染模型

主题页面由 **Next 的 bundler 在构建期打包**（dev 与 prod 一致），运行时按需 `import('@themes/{slug}/pages/{pageKey}')`。这是 React Server Components 的硬性要求——只有经过 Next bundler 的模块才能享有正确的 `react-server` 条件与单一 React 实例，客户端组件（`"use client"`）才能被 RSC 正确识别。

```
用户访问 / → 公开页面（src/app/(public)/page.tsx）
  ├─ 框架加载数据（listPublicArticles、getMergedSettings …）
  ├─ 组装 data + data.components（注入平台预建组件全集）
  ├─ resolveThemePage(activeTheme, 'home')
  │     ├─ import('@themes/{slug}/pages/home')  ← Next bundler 打包
  │     └─ fallback 链：活跃主题 → manifest.base → seanblog-default → slot 降级
  └─ <ThemePage data={...} />
```

> ⚠️ 上传主题的渲染边界：`import('@themes/...')` 在 prod 构建期打包**已存在于 `themes/` 的主题**。运行时通过 zip 新安装的主题会写入 `themes/`，但**不在已构建的 Next 产物中**，其 `pages/*.tsx` 在 prod 下会 fallback 到 slot 布局 + 主题 CSS（即仍生效样式与设置，但不执行该主题的 JSX 页面布局）。要让上传主题在 prod 获得完整 JSX 页面渲染，需重新构建/部署（dev 模式下 turbopack 可热加载新主题）。

主题页面是一个默认导出的 React 组件：

```tsx
// themes/my-theme/pages/home.tsx
import type { HomePageData } from '@/lib/theme/page-types'

export default function MyHomePage({ data }: { data: HomePageData }) {
  const { articles, pagination, settings, components } = data
  const { Pagination, ArticleCard } = components
  // …自行决定布局与样式
}
```

## 安全沙箱（import 白名单）

主题页面由 Next bundler 打包，因此 import 白名单（仅 react/next）由 **`npm run themes:build` 脚本与安装期 esbuild 校验**强制，不依赖运行时沙箱：

**允许 import：**

- `react`、`react/jsx-runtime`、`react-dom`（及子路径）
- `next`、`next/link` 等所有 `next/*`
- 主题包内**相对路径**（如 `../lib/settings-helpers`）

**禁止（`themes:build` / 安装期会报错）：**

- `@/*` 别名（平台内部模块）——需要平台能力请改用 `data.components` 注入
- 任意第三方 npm 包
- Node 内置模块（`node:fs`、`node:path`、`child_process` …）

> ⚠️ dev 模式下 turbopack 能解析 `@/`，所以白名单在 dev 不强制；务必在提交前运行 `npm run themes:build` 确保主题在严格白名单下可编译。安装期（zip 上传）也会执行该校验，编译失败则拒绝安装。
>
> 主题需要 Pagination、ArticleContent、CommentList 等组件时，**必须**从 `data.components` 解构获取。类型-only 的 `import type { ... } from '@/lib/theme/page-types'` 会被编译器擦除，不影响编译，可用于编辑器类型提示。

## 包结构

```text
my-theme/
  theme.json              # 清单
  pages/                  # 页面组件（.tsx，必有一个或多个）
    home.tsx
    article-detail.tsx
    taxonomy.tsx
    categories-index.tsx
    tags-index.tsx
    search.tsx
  lib/                    # 主题内部 helper（可选，仅可 import react/next）
    settings-helpers.ts
  assets/
    theme.css             # 主题样式
    callout.css           # 提示框预设样式（可选）
    preview.svg           # 预览图（可选）
```

页面 key 与对应数据类型（见 `src/lib/theme/page-types.ts`）：

| key | 数据类型 | 路由 |
|---|---|---|
| `home` | `HomePageData` | `/` |
| `article-detail` | `ArticleDetailPageData` | `/articles/[slug]` |
| `taxonomy` | `TaxonomyPageData` | `/categories/[slug]`、`/tags/[slug]` |
| `categories-index` | `CategoriesIndexPageData` | `/categories` |
| `tags-index` | `TagsIndexPageData` | `/tags` |
| `search` | `SearchPageData` | `/search` |

主题可只提供部分页面；缺失的页面自动 fallback 到 `manifest.base` 或 `seanblog-default`，最终走 slot 降级布局。

## 清单 `theme.json`

必填字段：

- `slug`：小写字母/数字/连字符/下划线，需与目录名一致
- `name`、`version`：显示名与版本
- `engine`：必须为 `seanblog-theme`
- `engineVersion`：当前为 `1`

可选字段：

- `author`、`description`、`previewImage`
- `assets.css`：默认 `assets/theme.css`
- `base`：父主题 slug，缺失页面从 base 继承
- `parts`：`header` / `footer` 各自的 `blocks` 数组，控制 Header/Footer 显隐
  - 可用 block：`SiteHeader`、`SearchDialog`、`SiteFooter`
- `settingsSchema`：自定义设置（见下）

示例：

```json
{
  "slug": "my-theme",
  "name": "My Theme",
  "version": "1.0.0",
  "engine": "seanblog-theme",
  "engineVersion": 1,
  "assets": { "css": "assets/theme.css" },
  "base": "seanblog-default",
  "parts": {
    "header": { "blocks": ["SiteHeader", "SearchDialog"] },
    "footer": { "blocks": ["SiteFooter"] }
  },
  "settingsSchema": { "视觉": [ /* … */ ] }
}
```

## 注入组件 `data.components`

框架在组装 `data` 时总是注入全集（见 `src/lib/theme/components.ts`），字段必填：

| 字段 | props | 用途 |
|---|---|---|
| `ArticleContent` | `{ html }` | 文章正文 HTML 渲染 |
| `ArticleMeta` | 元信息对象 | 文章元信息（时间/分类/标签/字数…） |
| `ArticleNavigation` | `{ previous, next }` | 上下篇导航 |
| `ArticleToc` | `{ headings }` | 文章目录 |
| `CommentList` | 评论对象 | 评论区（内含客户端表单） |
| `ArticleCard` | `{ article, priority? }` | 文章卡片 |
| `Pagination` | `{ currentPage, pageCount, hrefForPage }` | 分页 |
| `SearchDialog` | — | 搜索弹窗 |
| `MobileSidebar` | `{ side, children }` | 移动端侧边栏 |
| `HighlightedText` | `{ text, query }` | 搜索高亮文本 |
| `SiteHeader` / `SiteFooter` | `{ settings }` | 站点头尾 |

用法：

```tsx
const { Pagination, ArticleCard } = data.components
// <Pagination currentPage={pagination.page} pageCount={pagination.pageCount} hrefForPage={pageHref} />
```

## CSS 规则

`assets/theme.css` 由 `src/lib/theme/css-bundle.ts` 合并进前台 `<style>`。允许：

- 在 `:root` 定义 CSS 变量
- 为安全组件选择器（`.sb-*`、`.article-content` 等）定义样式
- 使用相对 `url(...)` 引用包内资源（自动重写为 `/api/themes/{slug}/asset`）
- `@media` 查询

禁止：`@import`、`!important`、远程/绝对/data URL、`<style>` 标签、`content` 中的 `<`/`>`。CSS 上限 100KB。

### 设置项 → CSS 变量

`settingsSchema` 中声明了 `cssVariable` 的项，其保存值会自动写入 `:root` 覆盖：

```json
{ "key": "accentColor", "type": "color", "default": "#cf829e", "cssVariable": "--color-accent" }
```

> 复杂设置（如布局选择、字体映射）可在主题页面内自行生成 CSS 变量并注入 `<style>`，参考 cardinal 主题的 `lib/settings-helpers.ts` 的 `buildDynamicCss`。

## 设置项 `settingsSchema`

按分组组织，每组是字段数组。支持的字段 `type`：

- `text`、`number`、`color`
- `boolean`（开关）
- `select`（单选，`options: [{label,value}]`；≤4 项渲染为单选按钮组）
- `multiselect`（多选，`options`）
- `list`（行列表，`itemFields: [{key,label,type}]`；后台支持增删行）

每项可选 `default`、`description`、`cssVariable`。设置在后台 `/admin/themes` 编辑，保存到 `ThemeCustomization` 表，与 schema 默认值合并后注入 `data.settings`。

## 色彩模式

主题可在 `settingsSchema` 声明 `colorMode`（`dark` / `light` / `auto`）与 `showThemeToggle`。框架在根布局：

1. 读 `sb-theme` cookie（用户偏好）→ 优先使用
2. 无 cookie 时取主题 `colorMode`：`dark`/`light` 直接生效；`auto` SSR 默认深色，首屏前内联脚本按系统偏好修正（无闪烁）

`showThemeToggle` 控制前台深浅色切换按钮显隐（在 `SiteHeader` 中消费）。

## 安装、预览、导出、卸载

- **安装**：后台 `/admin/themes` 上传 `.zip`（`theme.json` 在根）。服务端校验 zip-slip、文件数、大小、manifest schema、引擎版本、CSS 安全规则，然后运行 **esbuild 白名单校验**（fail-fast：违反白名单或编译失败则回滚不安装）。注意：安装后主题在 dev 可热加载完整 JSX 页面；在已构建的 prod 下仅 CSS+slot 生效，完整 JSX 页面需重新构建部署。
- **预览**：`/theme-preview?theme=<slug>&page=home|article`，需管理员会话，使用目标主题的 CSS/设置渲染（注意：当前预览页渲染默认 slot 布局 + 主题 CSS，尚未调用主题 `pages/*.tsx`，后续将升级为真实主题页预览）。
- **导出**：`GET /api/admin/themes/[name]` 下载 `{slug}-{version}.zip`（不含 `.build` 编译产物）。
- **卸载**：仅非默认、非当前活跃主题可删；删除目录与编译产物。

内置默认主题 `seanblog-default` 不可删除/覆盖。`cardinal` 是参考实现，演示了设置、侧边栏、布局切换等完整能力。

## 主题开发本地流程

```bash
# 1. 在 themes/{slug}/ 下新建包，按上面结构编写
# 2. 白名单校验（必做，提交前确保可编译）
npm run themes:build
# 3. dev 运行（turbopack 热加载，react-server 条件正确，可调试主题页面）
npm run dev
# 4. 后台 /admin/themes 启用主题，或设置 activeTheme
# 5. 上线前重新 build，让主题页面进入 Next 产物
npm run build
```

## 安全边界

- 主题页面由 Next bundler 在构建期打包，运行时不执行任意服务端代码。
- `themes:build` 与安装期 esbuild 校验强制 import 白名单（仅 react/next），拒绝 `@/*`、第三方包、Node 内置模块。
- 主题 CSS 经 postcss 校验，禁用危险构造。
- zip 导入防 Zip Slip、压缩炸弹、超大包、非法类型。
- 主题运行时只读 `data` 与 `data.components`，无法访问平台内部模块。
