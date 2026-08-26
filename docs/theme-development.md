# 主题包开发指南

SeanBlog 主题是基于目录结构的声明式包。它不是独立的 React 或 Node.js 代码，也不是单一的 CSS 文件。SeanBlog 读取清单文件（manifest）、模板、部件（parts）、设置项、CSS 和静态资源，然后通过内置的安全组件渲染。

## 包结构

```text
theme-slug/
  theme.json
  templates/
    home.json
    article-list.json
    article-detail.json
    taxonomy.json
    search.json
  parts/
    header.json
    footer.json
  assets/
    theme.css
    preview.svg
```

## 清单文件

`theme.json` 必须位于包根目录。

必填字段：

- `slug`：小写字母、数字、连字符或下划线；安装后必须与目录名一致。
- `name`：在后台主题库中显示的名称。
- `version`：包版本号。
- `engine`：必须为 `seanblog-theme`。
- `engineVersion`：当前为 `1`。
- `templates`：必须包含 `home`、`articleDetail`、`taxonomy` 和 `search`。

可选字段：

- `author`
- `description`
- `previewImage`
- `assets.css`
- `parts`
- `settingsSchema`
- `blocks`

## 模板与部件

模板和部件是 JSON 元数据文件。引擎读取允许的 `slots` 和 `blocks` 数组，只渲染这些内置前端组件。主题可以重新排序或省略支持的页面区域，而无需执行第三方代码。未知的 slots/blocks 会被忽略；如果模板没有有效的 slots，SeanBlog 会回退到默认页面结构。

主题声明中支持的 block 名称：

- `SiteHeader`
- `ArticleList`
- `ArticleCard`
- `ArticleContent`
- `TaxonomyList`
- `Pagination`
- `SearchDialog`
- `CommentList`
- `SiteFooter`

主题包不得包含可执行的服务端代码。上传任意 React、JavaScript、TypeScript 或 Node.js 模块用于执行是不支持的。

## CSS 规则

主题 CSS 按约定放在 `assets/theme.css`。它可以：

- 在 `:root` 上定义支持的 CSS 变量
- 为安全组件选择器定义样式：`.sb-*`、`.sf-*` 和 `.article-content`
- 使用相对路径 `url(...)` 引用包内文件；这些路径会被重写为主题资源 API

不可以：

- 使用 `@import`
- 使用 `!important`
- 引用绝对路径、远程 URL、data URL 或父目录 URL
- 包含 `<style>` 或类 HTML 内容
- 定位安全命名空间之外的任意全局选择器

## 主题 CSS 包共享

`src/lib/theme/css-bundle.ts` 中的 `buildThemeCssBundle()` 函数将主题 CSS（`assets/theme.css`）和设置项变量（`settingsSchema` 中声明了 `cssVariable` 的项）合并为完整的 CSS 包。

该 CSS 包被以下两处共用，确保编辑器预览与前台显示效果一致：

- **前台布局** `src/app/(public)/layout.tsx`：注入为 `<style>` 标签
- **文章编辑器预览** `/api/admin/articles/preview` API：返回 `themeCss` 字段，编辑器在预览时注入

主题作者无需关心此机制，只需确保 `theme.css` 和 `settingsSchema` 中的 `cssVariable` 声明正确即可。

## 设置项

`settingsSchema` 允许主题在 `/admin/personalization` 中暴露可编辑的设置项。

支持的字段类型：

- `text`
- `color`
- `number`
- `boolean`
- `select`

一个设置项可以声明 `cssVariable`；如果声明了，SeanBlog 会将保存的值写入 `:root` 上的 CSS 变量覆盖。

示例：

```json
{
  "key": "accentColor",
  "label": "强调色",
  "type": "color",
  "default": "#2563eb",
  "cssVariable": "--color-accent"
}
```

## 导入与导出

后台主题导入接受 `.zip` 格式的包，`theme.json` 位于 zip 根目录。服务器会校验：

- zip 结构和文件数量
- zip-slip / 路径穿越攻击
- 清单文件 schema 和主题引擎版本
- 必填模板
- CSS 安全规则
- 包大小限制

已安装的主题可以从主题库导出回 `.zip`。

## 预览

后台主题库为每个已安装主题提供两个预览链接：

- `/theme-preview?theme=<slug>&page=home`：使用选中主题的 CSS、设置、slots、Header 和 Footer 渲染公开首页。
- `/theme-preview?theme=<slug>&page=article`：使用选中主题渲染一篇真实的已发布文章页面，组件与前台一致。

预览路由需要管理员登录，且在管理布局之外渲染，以匹配前台外观。旧版 `/admin/personalization/preview` 路由会重定向到 `/theme-preview`。

## 默认主题

`themes/seanblog-default/` 是内置默认主题包。它遵循与第三方主题相同的包规则，不可从后台界面删除或覆盖。

视觉方向：

- 内容优先、简约、原生组件
- Inter 字体
- 黑/白/灰层次
- 蓝色强调色
- 清晰的边框和柔和的圆角
- 低干扰的 hover/focus 状态
- 移动优先响应式布局
