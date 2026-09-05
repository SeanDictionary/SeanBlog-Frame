# AGENTS.md

## 当前阶段

当前项目处于开发阶段，前期项目研判和框架的初步开发已经实现，相关 doc 文档已完成。

由于产品未实际上线，开发中涉及到对结构的修改和调整时，不需要考虑前向兼容性问题，可以直接进行修改和调整，以及必要的破坏性修改，如果该修改确实为最佳实现。**但「破坏性修改」有边界，见 [破坏性修改的边界](#破坏性修改的边界)。**

开发、修改、新增过程中，需要对涉及到的所有文档进行及时更新，保持文档的准确性和完整性。**文档更新是提交的硬性要求，见 [文档与变更记录](#文档与变更记录)。**

开发阶段可以按需创建测试数据，因为测试环境和生产环境是分离的，测试数据不会影响生产环境的数据，不需要清理测试数据，测试数据可以长期保留。

## 双仓库工作流（Frame × Themes）

本项目跨两个 git 仓库，必须理解二者关系，否则极易在错误仓库提交或漏改。

- **Frame 仓库**（`D:/Github/SeanBlog-Frame`，`origin: SeanDictionary/SeanBlog-Frame`）：测试环境，`npm run dev` → `http://localhost:3000`。
  - `themes/*` 被 `.gitignore` 忽略（`/themes/*`，仅 `!/themes/seanblog-default` 例外），是**本地测试副本**，**不入库**。改主题文件后直接被 dev server 读取生效，用于实时验证。
  - Frame 仅提交**平台侧**改动：`src/`、`public/`（含 `public/enhance.js`、`public/analytics.js` 等平台脚本）、`docs/`、`prisma/`、`scripts/`、根 `CHANGELOG.md` 等。
- **Themes 仓库**（`D:/Github/SeanBlog-Themes`，`origin: SeanDictionary/SeanBlog-Themes`）：主题源码，**唯一提交源**。
  - 每个主题一个目录（如 `cardinal/`），含 `theme.yaml`、`assets/`、`partials/`、`templates/`、`CHANGELOG.md`、`README.md`。
- **同步规则**：任何主题改动必须**同步修改两个仓库**——Frame 的 `themes/<theme>/*`（测试）与 Themes 的 `<theme>/*`（提交）。两边的文件内容必须一致（行尾差异 CRLF/LF 由各仓库既有约定处理，不影响内容）。
- **提交规则**：主题改动只提交到 **Themes**；平台侧改动只提交到 **Frame**。不要把 `themes/*` 的改动提交进 Frame，也不要在 Themes 提交平台脚本。

### 平台-主题契约（data-\* / helpers / ctx）

`public/enhance.js`、`public/analytics.js` 与主题的 `data-sb-*` 属性、Handlebars helpers、ctx 字段、`theme.yaml` 的 `settingsSchema` 字段共同构成**平台-主题契约**。

- 改平台脚本时，必须保证**旧主题（至少 `seanblog-default`）不挂**：新增行为只接线存在的元素，缺失即跳过（向后兼容）；或同步更新默认主题的 markup。
- 改主题 markup 引入新 `data-sb-*` 槽位时，需在对应平台脚本接线，并说明哪些是必需、哪些可选。
- 改 helper 签名 / ctx 字段 / `settingsSchema` 字段语义时，属于契约破坏，见 [破坏性修改的边界](#破坏性修改的边界)。

## 文档与变更记录

「及时更新文档」具体化为以下硬性要求：

- **每次提交若涉及行为 / 结构 / 配置 / 接口 / 设置项变更，必须同步更新对应 CHANGELOG**，无变更则可跳过：
  - Frame 改动 → 根 `CHANGELOG.md` 的 `## [Unreleased]` 段（按 Keep a Changelog 的 Added/Changed/Fixed/Removed 分类）。
  - 主题改动 → `SeanBlog-Themes/<theme>/CHANGELOG.md` 的 `## [Unreleased]`（发版时再移至 `## [版本号]`）。
- **其他文档随变更同步**：`README.md`、`docs/` 下架构文档（`theme-framework.md`、`theme-development.md`、`data-model.md` 等）、`theme.yaml` 的 `settingsSchema` 说明、`settingsVersion` 等。新增/重命名字段必须同步文档。
- **版本迭代**：
  - 主题发版：bump `theme.yaml` 的 `version`（语义化版本）→ 更新 CHANGELOG 版本段 → 提交 → 打 `v*.*.*` tag → push（默认 push Themes，Frame 默认保持本地除非额外要求）。
  - Frame 发版：按根 `CHANGELOG.md` 顶部「发布流程」，打 `v*.*.*` tag，CI 从 CHANGELOG 提取 Release 正文。
- 不要把 CHANGELOG 当事后补丁：提交信息与 CHANGELOG 条目应在同一次提交中一起出现。

## 验证要求

- **UI / 交互 / 样式 / 布局改动，必须在 `localhost:3000` 用浏览器实际验证**，不能仅靠代码审阅。可用 `chrome-devtools`、`playwright` mcp 工具。
- 涉及可视属性（间距、尺寸、弹窗定位、对齐）时，**用 `evaluate` 取实测数值**（坐标、宽高、计算样式）佐证，不只靠截图或主观判断；模型无法看图时实测数值是唯一可靠证据。
- 修复类改动：先复现（记录坏状态的实测值）→ 改 → 再测（记录好状态的实测值），两相对照写入汇报。
- 涉及数据/导入/导出时，用 admin API 或 `prisma` 实测数量/状态确认，不要只看「没报错」。

## 破坏性修改的边界

开发阶段允许破坏性修改，但**边界如下**：

- **可破坏（框架内部）**：Prisma schema、内部 service、内部 API、admin UI 组件、构建配置、`docs/` 架构文档。直接改，不需前向兼容。
- **尽量稳定（公开契约）**：平台-主题契约（`data-sb-*` 属性名、helper 名与签名、ctx 字段、`theme.yaml` `settingsSchema` 字段语义）。必须破坏时：
  1. 同步更新 `seanblog-default` 主题；
  2. 同步更新所有受影响主题（cardinal 等）；
  3. 同步更新 `docs/theme-development.md` 等契约文档；
  4. 在 CHANGELOG 中显式标注为破坏性变更（`Changed`/`Removed`）。
- **站点数据**：迁移、删表、改字段类型等会影响存量数据的操作，即便在开发阶段也需在执行前确认（参见全局 AGENTS 的敏感命令要求）。

## 开发约束

- 保持代码的简洁性，避免过度设计和复杂化
- 遵循最佳实践和设计模式，确保代码的可读性和可扩展性
- 避免重复代码，提取公共逻辑和组件
- 涉及到 ui/ux 设计部分，请遵循现代设计原则，确保界面美观、易用。可以使用 `ui-ux-pro-max`, `web-design-guidelines`, `frontend-design`, `vercel-react-view-transitions` 等相关 skill，并且搭配 `chrome-devtools`, `playwright` 这两个浏览器自动化 mcp 工具

## 提交规范

- 遵循 [Conventional Commits](https://www.conventionalcommits.org/)：`feat` / `fix` / `docs` / `refactor` / `chore` / `perf`，可带 scope，如 `feat(cardinal): …`、`fix(search): …`、`fix(install): …`。
- 提交信息首行简短，正文说明动机/根因/影响（参考仓库历史风格）。
- 一次提交一个完整意图，不要把无关改动混在一起；跨仓库相关改动分别提交到各自仓库。
- **默认 push 策略**：Themes 仓库按需迭代版本并 push；Frame 仓库**默认保持本地**，除非用户额外要求 push。

## 后台管理员

admin
YYK9gZJdXa6iAJdCwCBmUbWOuqJKm5lU

如果密码不对可以使用脚本重新生成密码，同时需要告知用户，并更新上方密码
