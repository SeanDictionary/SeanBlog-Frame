# SeanBlog Frame 前端开发计划

## 技术选型

| 类别 | 选择 | 说明 |
|---|---|---|
| 样式框架 | Tailwind CSS v4 | 原子化 CSS，与 Next.js 生态契合 |
| 组件库 | shadcn/ui | 按需引入、可定制、不增加包体积 |
| 图标 | FontAwesome 7 (CDN) | 外部引用，零本地依赖 |
| 辅助图标 | Lucide React | shadcn/ui 内部组件使用的图标库 |
| 字体 | next/font (Inter + 中文回退) | 内置优化，自动子集化 |
| 数据获取 | Server Component 直调 service | 前台页面不走 /api |
| 写操作 | Server Actions | 评论提交、后台管理操作 |
| 主题系统 | CSS 变量 + 可导入 CSS 文件 | 默认双色主题，支持导入自定义主题 |

## 路由结构

```
src/app/
├── layout.tsx                          # 根布局：字体、全局样式、metadata
├── (public)/                           # 前台路由组（主题作用范围）
│   ├── layout.tsx                      # 前台布局：SiteHeader + SiteFooter
│   ├── page.tsx                        # 首页：置顶 + 最新文章列表
│   ├── articles/
│   │   └── [slug]/
│   │       └── page.tsx                # 文章详情：正文 + 目录 + 评论
│   ├── categories/
│   │   └── [slug]/
│   │       └── page.tsx                # 分类页：该分类下的文章列表
│   ├── tags/
│   │   └── [slug]/
│   │       └── page.tsx                # 标签页：该标签下的文章列表
│   └── search/
│       └── page.tsx                    # 搜索结果页
├── admin/                              # 后台路由组（不跟随主题）
│   ├── layout.tsx                      # 后台布局：侧边栏 + 鉴权守卫
│   ├── page.tsx                        # 仪表盘
│   ├── articles/
│   │   ├── page.tsx                    # 文章列表
│   │   ├── new/page.tsx                # 新建文章
│   │   └── [id]/edit/page.tsx          # 编辑文章
│   ├── categories/page.tsx             # 分类管理
│   ├── tags/page.tsx                   # 标签管理
│   ├── comments/page.tsx               # 评论审核
│   ├── media/page.tsx                  # 媒体管理
│   └── settings/page.tsx               # 站点设置
├── login/page.tsx                      # 登录页
└── (已有的 API / robots / sitemap / rss 路由保持不动)
```

## 组件结构

```
src/components/
├── ui/                                 # shadcn/ui 基础组件（按需添加）
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── separator.tsx
│   ├── skeleton.tsx
│   ├── badge.tsx
│   ├── textarea.tsx
│   ├── select.tsx
│   ├── table.tsx
│   └── ...
├── layout/                             # 布局组件
│   ├── site-header.tsx                 # 前台顶部导航
│   ├── site-footer.tsx                 # 前台页脚
│   └── admin-sidebar.tsx               # 后台侧边栏
├── article/                            # 文章组件
│   ├── article-card.tsx                # 文章卡片（列表页用）
│   ├── article-content.tsx             # 正文渲染
│   ├── article-toc.tsx                 # 文章目录
│   └── article-meta.tsx                # 元信息：日期、分类、标签、浏览量
├── comment/                            # 评论组件
│   ├── comment-list.tsx                # 评论列表（嵌套回复）
│   ├── comment-form.tsx                # 评论提交表单（Client Component）
│   └── comment-item.tsx                # 单条评论
├── search/                             # 搜索组件
│   └── search-dialog.tsx               # 搜索弹窗（Client Component）
└── pagination.tsx                      # 通用分页
```

## 主题系统设计

### 存储结构

```
themes/
├── seanblog-default/                    # 默认主题包（随项目发布）
│   ├── theme.json                       # 主题清单、模板映射、设置 schema
│   ├── templates/                       # 首页、文章详情、归档、搜索等声明式模板
│   ├── parts/                           # Header/Footer/Dock 等模板部件
│   └── assets/                          # theme.css、预览图、字体或图片资源
└── starter/                             # 第三方主题开发示例包
```

### 实现方式

1. **主题包方案**：所有主题（包括默认主题）都是目录式 package，必须包含 `theme.json`，不再支持单独 CSS 文件作为主题。
2. **声明式模板**：主题通过 `templates/*.json` 与 `parts/*.json` 组合平台白名单 block/component，不执行第三方 React/Node 代码。
3. **当前主题包**存入 `SiteSetting`（key: `activeTheme`），默认值为 `seanblog-default`。
4. **导入/导出**：后台导入 `.zip` 主题包，服务端校验 zip-slip、manifest、模板、资源和 CSS 安全规则；导出也以 `.zip` 主题包形式提供。
5. **主题资源**：主题 CSS 位于 `assets/theme.css`，只能使用安全 CSS 变量和 `.sb-*` / `.sf-*` / `.article-content` 命名空间；相对资源引用会被重写到主题资产 API。
6. **主题作用域**：只影响 `(public)` 路由组下的前台页面，后台界面保持固定样式。
7. **持久化**：Docker 部署时 `themes/` 目录挂载 volume，与 `content/` 同等对待。

### 默认主题包要求

默认主题不再是 `themes/default/theme.css`。默认主题包为 `themes/seanblog-default/`，延续内容优先、极简、原生组件风格，并提供完整 `theme.json`、模板、部件、settings schema、预览图和资源目录。

---

## 开发阶段

### Phase 1：基础搭建

**目标**：建立样式体系、布局骨架、主题基础设施

| 步骤 | 内容 | 涉及文件 |
|---|---|---|
| 1.1 | 安装 Tailwind CSS v4 + PostCSS 配置 | package.json, postcss.config.mjs, src/app/globals.css |
| 1.2 | 初始化 shadcn/ui | components.json, src/components/ui/*, src/lib/utils.ts |
| 1.3 | 配置 next/font 字体 | src/app/layout.tsx |
| 1.4 | 引入 FontAwesome CDN | src/app/layout.tsx |
| 1.5 | 创建默认主题包 | src/app/globals.css, themes/seanblog-default/theme.json, themes/seanblog-default/assets/theme.css |
| 1.6 | 创建主题加载工具 | src/lib/theme.ts |
| 1.7 | 创建前台路由组 (public) | src/app/(public)/layout.tsx |
| 1.8 | 创建 SiteHeader 组件 | src/components/layout/site-header.tsx |
| 1.9 | 创建 SiteFooter 组件 | src/components/layout/site-footer.tsx |
| 1.10 | 更新首页为实际内容 | src/app/(public)/page.tsx |

**提交**：`feat: set up Tailwind CSS, shadcn/ui, theme system, and public layout`

### Phase 2：前台展示页面

**目标**：完成所有前台页面的展示功能

| 步骤 | 内容 | 涉及文件 |
|---|---|---|
| 2.1 | 文章卡片组件 | src/components/article/article-card.tsx |
| 2.2 | 分页组件 | src/components/pagination.tsx |
| 2.3 | 首页完善（置顶 + 列表 + 分页 + 排序；默认发布时间排序保留置顶区，切换更新时间/浏览量/评论数时按字段混排） | src/app/(public)/page.tsx |
| 2.4 | 文章元信息组件：发布时间、浏览量、分类标签，以及可由后台开关控制的预估阅读时间和文章字数 | src/components/article/article-meta.tsx |
| 2.5 | 文章正文组件 | src/components/article/article-content.tsx |
| 2.6 | 文章目录组件：有目录时在桌面端悬浮右侧，不占用正文排版空间 | src/components/article/article-toc.tsx |
| 2.7 | 文章详情页：正文、元信息、悬浮目录、上一篇/下一篇导航 | src/app/(public)/articles/[slug]/page.tsx |
| 2.8 | 评论组件（列表 + 表单 + 单条） | src/components/comment/* |
| 2.9 | 文章详情页集成评论区 | src/app/(public)/articles/[slug]/page.tsx |
| 2.10 | 分类页 | src/app/(public)/categories/[slug]/page.tsx |
| 2.11 | 标签页 | src/app/(public)/tags/[slug]/page.tsx |
| 2.12 | 搜索弹窗组件：搜索按钮保持常驻、弹窗居中、支持空格/`+` 多关键词实时搜索和关键词高亮 | src/components/search/search-dialog.tsx |
| 2.13 | 搜索结果页：SSR 搜索结果、分页、标题/摘要关键词高亮 | src/app/(public)/search/page.tsx |

**提交**：按功能分 2-3 次提交

### Phase 3：认证与管理后台

**目标**：完成管理后台全部功能

| 步骤 | 内容 |
|---|---|
| 3.1 | 登录页 |
| 3.2 | 后台布局（可展开/缩小且固定左侧的侧边栏 + 鉴权守卫；缩小时仅显示图标） |
| 3.3 | 仪表盘（统计卡片 + 管理按钮；支持卡片拖拽排序、显示/隐藏并自动保存） |
| 3.4 | 文章管理（列表 + 新建 + 编辑） |
| 3.5 | 分类/标签管理 |
| 3.6 | 评论审核 |
| 3.7 | 媒体管理 |
| 3.8 | 站点设置（含主题管理） |

### Phase 4：打磨优化

| 步骤 | 内容 |
|---|---|
| 4.1 | 移动端响应式适配 |
| 4.2 | 代码高亮（Shiki 或 Prism） |
| 4.3 | SEO 优化（动态 metadata、Open Graph） |
| 4.4 | 页面加载状态与错误边界 |
| 4.5 | 主题包导入/导出功能完善 |
