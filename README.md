# SeanBlog Frame

一个面向长期使用的个人博客 CMS 项目，用于替代 WordPress。

当前阶段仍处于策划与文档沉淀阶段，核心技术栈已确定为：

- Next.js
- PostgreSQL
- Prisma
- Auth.js
- Docker

## 项目定位

这个项目的目标不是做一个“能发文章的 demo”，而是构建一个可长期维护、可逐步扩展、具备完整后台管理能力的生产级个人博客 CMS。

预期覆盖：

- 个人博客前台
- 后台管理系统
- 内容生产与发布流程
- 评论与审核机制
- SEO 与内容分发能力
- 后续 AI / 搜索 / 缓存扩展能力

## 文档索引

当前项目文档按产品、架构、数据、权限、SEO、路线图拆分维护：

- [PRD](docs/prd.md)
- [系统架构](docs/architecture.md)
- [数据模型](docs/data-model.md)
- [后台与权限](docs/admin-and-auth.md)
- [SEO 与内容系统](docs/seo-and-content.md)
- [开发路线图](docs/implementation-roadmap.md)
- [后端接口约定](docs/backend-api.md)
- [OpenAPI 导入文件](docs/openapi.json)

## 当前阶段产出

当前文档主要用于：

- 明确产品目标与 MVP 边界
- 固化核心技术决策
- 为后续项目初始化与编码提供约束
- 降低后续开发时需求和架构反复变动的成本

## 下一步建议

建议按以下顺序进入实现阶段：

1. 初始化 Next.js App Router 项目
2. 初始化 Prisma 与 PostgreSQL
3. 建立 Auth.js 单管理员登录基线
4. 完成文章、分类、标签的核心内容系统
5. 完成博客前台与后台管理面板
6. 补齐评论、SEO、部署与生产能力
