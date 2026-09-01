// 由实际路由重建 docs/openapi.json 的 paths/tags。
// components（schemas/parameters/responses/securitySchemes）沿用既有定义。
import { readFileSync, writeFileSync } from 'node:fs'

const prev = JSON.parse(readFileSync(new URL('../docs/openapi.json', import.meta.url), 'utf8'))

const TAGS = [
  { name: '公开访问', description: '无需认证的访客访问埋点、评论提交、搜索、健康检查与主题资源接口。' },
  { name: '认证', description: '由 Auth.js 管理的单管理员账户认证相关接口。' },
  { name: '内容分发', description: 'RSS、站点地图、robots 等供爬虫与订阅器使用的运行时端点。' },
  { name: '后台文章管理', description: '需要管理员会话的文章 CRUD、批量操作、导入导出、预览、修订历史与发布/归档接口。' },
  { name: '后台分类管理', description: '需要管理员会话的分类 CRUD、slug 生成与批量操作接口。' },
  { name: '后台标签管理', description: '需要管理员会话的标签 CRUD、slug 生成与批量操作接口。' },
  { name: '后台评论审核', description: '需要管理员会话的评论列表、批量与单条审核及删除接口。' },
  { name: '后台媒体管理', description: '需要管理员会话的媒体列表、上传（multipart）与批量/单条删除接口。' },
  { name: '后台站点设置', description: '需要管理员会话的站点键值设置读写接口。' },
  { name: '后台主题管理', description: '需要管理员会话的主题列表、上传安装、详情/导出、删除与自定义设置保存接口。' },
  { name: '后台操作日志', description: '需要管理员会话的操作日志查询与 CSV 导出接口。' },
  { name: '后台分析导出', description: '需要管理员会话的访客/访问记录 CSV 导出接口。' },
  { name: '后台工具', description: '需要管理员会话的辅助校验接口（主题 CSS 校验）。' },
]

const adminSec = [{ adminSession: [] }]
const std200 = { description: '操作成功。' }
const std201 = { description: '创建成功。' }
const std204 = { $ref: '#/components/responses/NoContent' }
const std400 = { $ref: '#/components/responses/ValidationError' }
const std401 = { $ref: '#/components/responses/Unauthorized' }
const std404 = { $ref: '#/components/responses/NotFound' }
const std409 = { $ref: '#/components/responses/Conflict' }
const std500 = { $ref: '#/components/responses/InternalServerError' }

const adminErrs = { 400: std400, 401: std401, 404: std404, 409: std409, 500: std500 }

const p = (name, ref = `#/components/parameters/${name}`) => ({ $ref: ref })

function jsonBody(schemaRef, description = '请求体。') {
  return { required: true, description, content: { 'application/json': { schema: { $ref: schemaRef } } } }
}
function jsonOk(ref, description = '操作成功。') {
  return { description, content: { 'application/json': { schema: { $ref: ref } } } }
}
function jsonOkInline(props, description = '操作成功。') {
  return { description, content: { 'application/json': { schema: { type: 'object', properties: props } } } }
}
function op(tag, summary, extra = {}) {
  const o = { tags: [tag], summary, security: adminSec, responses: {} }
  if (extra.parameters) o.parameters = extra.parameters
  if (extra.requestBody) o.requestBody = extra.requestBody
  o.responses = { 200: std200, ...adminErrs, ...(extra.responses || {}) }
  delete extra.parameters; delete extra.requestBody; delete extra.responses
  return o
}
function publicOp(tag, summary, extra = {}) {
  const o = { tags: [tag], summary, responses: {} }
  if (extra.parameters) o.parameters = extra.parameters
  if (extra.requestBody) o.requestBody = extra.requestBody
  o.responses = { 200: std200, ...(extra.responses || {}) }
  return o
}

const paths = {}

function set(path, method, operation) {
  paths[path] = paths[path] || {}
  paths[path][method] = operation
}

// ============ 后台文章管理 ============
const T_ART = '后台文章管理'
set('/api/admin/articles', 'get', {
  ...op(T_ART, '后台获取文章列表', {
    parameters: [
      p('Page'), p('PageSize'),
      { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/ArticleStatus' }, description: '文章状态筛选，空值视为未传。', allowEmptyValue: true },
      { name: 'category', in: 'query', schema: { type: 'string' }, description: '分类 slug 筛选。', allowEmptyValue: true },
      { name: 'tag', in: 'query', schema: { type: 'string' }, description: '标签 slug 筛选。', allowEmptyValue: true },
      { name: 'q', in: 'query', schema: { type: 'string' }, description: '关键词筛选。', allowEmptyValue: true },
      { name: 'sort', in: 'query', schema: { type: 'string' }, description: '排序字段（publishedAt / updatedAt / viewCount / visitorCount / commentCount）。', allowEmptyValue: true },
      { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] }, description: '排序方向。', allowEmptyValue: true },
    ],
    responses: { 200: jsonOkInline({ items: { type: 'array', items: { $ref: '#/components/schemas/AdminArticleSummary' } }, meta: { $ref: '#/components/schemas/PageMeta' } }, '后台文章分页列表。') },
  }),
})
set('/api/admin/articles', 'post', {
  ...op(T_ART, '后台新建文章', {
    requestBody: jsonBody('#/components/schemas/ArticleInput'),
    responses: { 201: jsonOk('#/components/schemas/AdminArticleDetail', '创建成功，返回文章详情。') },
  }),
})
set('/api/admin/articles/slug', 'get', {
  ...op(T_ART, '生成或校验文章 slug', {
    parameters: [
      { name: 'title', in: 'query', required: true, schema: { type: 'string' }, description: '文章标题，用于生成 slug。' },
      { name: 'id', in: 'query', schema: { type: 'string' }, description: '当前文章 id（编辑时排除自身做唯一性校验）。', allowEmptyValue: true },
    ],
    responses: { 200: jsonOkInline({ slug: { type: 'string' } }, '可用的 slug。') },
  }),
})
set('/api/admin/articles/bulk', 'post', {
  ...op(T_ART, '批量操作文章（删除 / 归档 / 取消归档）', {
    requestBody: jsonBody('#/components/schemas/ArticleBulkActionInput'),
    responses: { 200: jsonOkInline({ count: { type: 'integer' } }, '受影响条数。') },
  }),
})
set('/api/admin/articles/export', 'get', {
  ...op(T_ART, '导出文章为 ZIP 文章包', {
    parameters: [
      { name: 'ids', in: 'query', schema: { type: 'string' }, description: '逗号分隔的文章 id 列表；不传则按全部导出。', allowEmptyValue: true },
      { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/ArticleStatus' }, allowEmptyValue: true },
    ],
    responses: { 200: { description: 'ZIP 文章包。', content: { 'application/zip': { schema: { type: 'string', format: 'binary' } } } } },
  }),
})
set('/api/admin/articles/import', 'post', {
  ...op(T_ART, '导入 ZIP 文章包', {
    requestBody: { required: true, description: 'multipart/form-data，字段 file 为 .zip 文章包。', content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } },
    responses: { 200: jsonOk('#/components/schemas/ArticleImportInput', '导入结果。') },
  }),
})
set('/api/admin/articles/preview', 'post', {
  ...op(T_ART, '预览 Markdown 渲染（复用主题 CSS）', {
    requestBody: jsonBody('#/components/schemas/MarkdownPreviewInput'),
    responses: { 200: jsonOk('#/components/schemas/MarkdownPreviewResult', '渲染结果。') },
  }),
})
set('/api/admin/articles/{id}', 'get', {
  ...op(T_ART, '后台获取文章详情', {
    parameters: [p('Id')],
    responses: { 200: jsonOk('#/components/schemas/AdminArticleDetail', '文章详情。') },
  }),
})
set('/api/admin/articles/{id}', 'patch', {
  ...op(T_ART, '后台更新文章', {
    parameters: [p('Id')],
    requestBody: jsonBody('#/components/schemas/ArticleUpdateInput'),
    responses: { 200: jsonOk('#/components/schemas/AdminArticleDetail', '更新后的文章详情。') },
  }),
})
set('/api/admin/articles/{id}', 'delete', {
  ...op(T_ART, '删除文章（同步删除正文文件与媒体引用）', {
    parameters: [p('Id')],
    responses: { 204: std204 },
  }),
})
set('/api/admin/articles/{id}/archive', 'post', {
  ...op(T_ART, '归档文章', {
    parameters: [p('Id')],
    responses: { 200: jsonOk('#/components/schemas/AdminArticleDetail', '归档后的文章详情。') },
  }),
})
set('/api/admin/articles/{id}/publish', 'post', {
  ...op(T_ART, '发布 / 取消发布文章（支持定时发布）', {
    parameters: [p('Id')],
    responses: { 200: jsonOk('#/components/schemas/AdminArticleDetail', '发布状态更新后的文章详情。') },
  }),
})
set('/api/admin/articles/{id}/revisions/{revisionId}', 'get', {
  ...op(T_ART, '获取文章历史修订详情', {
    parameters: [p('Id'), { name: 'revisionId', in: 'path', required: true, schema: { type: 'string' }, description: '修订版本 id。' }],
    responses: { 200: jsonOk('#/components/schemas/ArticleRevisionDetail', '修订版本详情。') },
  }),
})

// ============ 后台分类管理 ============
const T_CAT = '后台分类管理'
set('/api/admin/categories', 'get', {
  ...op(T_CAT, '后台获取分类列表', {
    parameters: [p('Page'), p('PageSize'), { name: 'q', in: 'query', schema: { type: 'string' }, allowEmptyValue: true }],
    responses: { 200: jsonOkInline({ items: { type: 'array', items: { $ref: '#/components/schemas/Category' } }, meta: { $ref: '#/components/schemas/PageMeta' } }) },
  }),
})
set('/api/admin/categories', 'post', {
  ...op(T_CAT, '新建分类', { requestBody: jsonBody('#/components/schemas/CategoryInput'), responses: { 201: jsonOk('#/components/schemas/Category') } }),
})
set('/api/admin/categories/slug', 'get', {
  ...op(T_CAT, '生成或校验分类 slug', {
    parameters: [{ name: 'title', in: 'query', required: true, schema: { type: 'string' } }, { name: 'id', in: 'query', schema: { type: 'string' }, allowEmptyValue: true }],
    responses: { 200: jsonOkInline({ slug: { type: 'string' } }) },
  }),
})
set('/api/admin/categories/bulk', 'post', {
  ...op(T_CAT, '批量删除分类', {
    requestBody: { required: true, description: '批量操作。', content: { 'application/json': { schema: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', items: { type: 'string' } } } } } } },
    responses: { 200: jsonOkInline({ count: { type: 'integer' } }) },
  }),
})
set('/api/admin/categories/{id}', 'patch', {
  ...op(T_CAT, '更新分类', { parameters: [p('Id')], requestBody: jsonBody('#/components/schemas/CategoryUpdateInput'), responses: { 200: jsonOk('#/components/schemas/Category') } }),
})
set('/api/admin/categories/{id}', 'delete', {
  ...op(T_CAT, '删除分类（文章的 categoryId 置空）', { parameters: [p('Id')], responses: { 204: std204 } }),
})

// ============ 后台标签管理 ============
const T_TAG = '后台标签管理'
set('/api/admin/tags', 'get', {
  ...op(T_TAG, '后台获取标签列表', {
    parameters: [p('Page'), p('PageSize'), { name: 'q', in: 'query', schema: { type: 'string' }, allowEmptyValue: true }],
    responses: { 200: jsonOkInline({ items: { type: 'array', items: { $ref: '#/components/schemas/Tag' } }, meta: { $ref: '#/components/schemas/PageMeta' } }) },
  }),
})
set('/api/admin/tags', 'post', {
  ...op(T_TAG, '新建标签', { requestBody: jsonBody('#/components/schemas/TagInput'), responses: { 201: jsonOk('#/components/schemas/Tag') } }),
})
set('/api/admin/tags/slug', 'get', {
  ...op(T_TAG, '生成或校验标签 slug', {
    parameters: [{ name: 'title', in: 'query', required: true, schema: { type: 'string' } }, { name: 'id', in: 'query', schema: { type: 'string' }, allowEmptyValue: true }],
    responses: { 200: jsonOkInline({ slug: { type: 'string' } }) },
  }),
})
set('/api/admin/tags/bulk', 'post', {
  ...op(T_TAG, '批量删除标签', {
    requestBody: { required: true, description: '批量操作。', content: { 'application/json': { schema: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', items: { type: 'string' } } } } } } },
    responses: { 200: jsonOkInline({ count: { type: 'integer' } }) },
  }),
})
set('/api/admin/tags/{id}', 'patch', {
  ...op(T_TAG, '更新标签', { parameters: [p('Id')], requestBody: jsonBody('#/components/schemas/TagUpdateInput'), responses: { 200: jsonOk('#/components/schemas/Tag') } }),
})
set('/api/admin/tags/{id}', 'delete', {
  ...op(T_TAG, '删除标签（自动清理 ArticleTag 关联）', { parameters: [p('Id')], responses: { 204: std204 } }),
})

// ============ 后台评论审核 ============
const T_CMT = '后台评论审核'
set('/api/admin/comments', 'get', {
  ...op(T_CMT, '后台获取评论列表', {
    parameters: [p('Page'), p('PageSize'), { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/CommentStatus' }, allowEmptyValue: true }, { name: 'articleId', in: 'query', schema: { type: 'string' }, allowEmptyValue: true }, { name: 'q', in: 'query', schema: { type: 'string' }, allowEmptyValue: true }],
    responses: { 200: jsonOkInline({ items: { type: 'array', items: { $ref: '#/components/schemas/AdminComment' } }, meta: { $ref: '#/components/schemas/PageMeta' } }) },
  }),
})
set('/api/admin/comments/bulk', 'patch', {
  ...op(T_CMT, '批量审核评论', { requestBody: jsonBody('#/components/schemas/CommentModerationInput'), responses: { 200: jsonOkInline({ count: { type: 'integer' } }) } }),
})
set('/api/admin/comments/{id}', 'patch', {
  ...op(T_CMT, '审核单条评论', { parameters: [p('Id')], requestBody: jsonBody('#/components/schemas/CommentModerationInput'), responses: { 200: jsonOk('#/components/schemas/AdminComment') } }),
})
set('/api/admin/comments/{id}', 'delete', {
  ...op(T_CMT, '删除评论（软删 → TRASHED）', { parameters: [p('Id')], responses: { 204: std204 } }),
})

// ============ 后台操作日志 ============
const T_LOG = '后台操作日志'
set('/api/admin/logs', 'get', {
  ...op(T_LOG, '查询操作日志列表', {
    parameters: [p('Page'), p('PageSize'), { name: 'module', in: 'query', schema: { type: 'string' }, allowEmptyValue: true }, { name: 'result', in: 'query', schema: { type: 'string', enum: ['SUCCESS', 'FAILURE'] }, allowEmptyValue: true }, { name: 'q', in: 'query', schema: { type: 'string' }, allowEmptyValue: true }],
    responses: { 200: jsonOkInline({ items: { type: 'array', items: { type: 'object' } }, meta: { $ref: '#/components/schemas/PageMeta' } }) },
  }),
})
set('/api/admin/logs/export', 'get', {
  ...op(T_LOG, '导出操作日志 CSV', {
    parameters: [{ name: 'module', in: 'query', schema: { type: 'string' }, allowEmptyValue: true }, { name: 'result', in: 'query', schema: { type: 'string', enum: ['SUCCESS', 'FAILURE'] }, allowEmptyValue: true }, { name: 'q', in: 'query', schema: { type: 'string' }, allowEmptyValue: true }],
    responses: { 200: { description: 'UTF-8 BOM CSV。', content: { 'text/csv': { schema: { type: 'string' } } } } },
  }),
})

// ============ 后台媒体管理 ============
const T_MED = '后台媒体管理'
set('/api/admin/media', 'get', {
  ...op(T_MED, '获取媒体列表', {
    parameters: [p('Page'), p('PageSize'), { name: 'category', in: 'query', schema: { type: 'string', enum: ['images', 'videos', 'audio', 'documents', 'archives', 'other'] }, allowEmptyValue: true }],
    responses: { 200: jsonOkInline({ items: { type: 'array', items: { $ref: '#/components/schemas/Media' } }, meta: { $ref: '#/components/schemas/PageMeta' } }) },
  }),
})
set('/api/admin/media/upload', 'post', {
  ...op(T_MED, '上传媒体文件（支持多选 / 粘贴 / 拖拽）', {
    requestBody: { required: true, description: 'multipart/form-data，字段 files 为一个或多个文件。', content: { 'multipart/form-data': { schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } } } } },
    responses: { 201: jsonOk('#/components/schemas/Media', '上传结果（首个媒体记录）。') },
  }),
})
set('/api/admin/media/bulk', 'delete', {
  ...op(T_MED, '批量删除媒体（同步删除本地文件）', {
    requestBody: { required: true, description: '批量删除。', content: { 'application/json': { schema: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', items: { type: 'string' } } } } } } },
    responses: { 200: jsonOkInline({ count: { type: 'integer' } }) },
  }),
})
set('/api/admin/media/{id}', 'delete', {
  ...op(T_MED, '删除单个媒体（同步删除本地文件）', { parameters: [p('Id')], responses: { 204: std204 } }),
})

// ============ 后台站点设置 ============
const T_SET = '后台站点设置'
set('/api/admin/settings', 'get', {
  ...op(T_SET, '读取站点设置（可按 scope 过滤）', {
    parameters: [{ name: 'scope', in: 'query', schema: { type: 'string', enum: ['site-info', 'analytics', 'public-layout', 'theme-settings'] }, allowEmptyValue: true }],
    responses: { 200: { description: '键值映射对象。', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
  }),
})
set('/api/admin/settings', 'put', {
  ...op(T_SET, '保存站点设置（按 scope 分组）', {
    requestBody: jsonBody('#/components/schemas/SettingInput'),
    responses: { 200: { description: '保存成功。', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
  }),
})
set('/api/admin/settings/{key}', 'get', {
  ...op(T_SET, '读取单个站点设置', { parameters: [p('SettingKey')], responses: { 200: jsonOk('#/components/schemas/SiteSetting') } }),
})
set('/api/admin/settings/{key}', 'put', {
  ...op(T_SET, '更新单个站点设置', { parameters: [p('SettingKey')], requestBody: jsonBody('#/components/schemas/SettingInput'), responses: { 200: jsonOk('#/components/schemas/SiteSetting') } }),
})

// ============ 后台主题管理 ============
const T_THM = '后台主题管理'
set('/api/admin/themes', 'get', {
  ...op(T_THM, '获取已安装主题列表', { responses: { 200: { description: '主题清单数组。', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } } } }),
})
set('/api/admin/themes', 'post', {
  ...op(T_THM, '上传安装主题 ZIP 包', {
    requestBody: { required: true, description: 'multipart/form-data，字段 file 为主题 .zip。', content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } },
    responses: { 201: { description: '安装成功。', content: { 'application/json': { schema: { type: 'object' } } } } },
  }),
})
set('/api/admin/themes/{name}', 'get', {
  ...op(T_THM, '获取主题详情 / 导出主题 ZIP', {
    parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' }, description: '主题 slug。' }, { name: 'includeSettings', in: 'query', schema: { type: 'boolean' }, allowEmptyValue: true, description: '导出时是否附带全量有效设置快照。' }],
    responses: { 200: { description: '主题详情 JSON 或 ZIP 主题包。', content: { 'application/json': { schema: { type: 'object' } }, 'application/zip': { schema: { type: 'string', format: 'binary' } } } } },
  }),
})
set('/api/admin/themes/{name}', 'delete', {
  ...op(T_THM, '删除主题（默认与当前启用主题不可删）', { parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }], responses: { 204: std204 } }),
})
set('/api/admin/themes/{name}/settings', 'put', {
  ...op(T_THM, '保存主题自定义设置', {
    parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
    requestBody: { required: true, description: '主题设置键值。', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
    responses: { 200: { description: '保存成功。', content: { 'application/json': { schema: { type: 'object' } } } } },
  }),
})

// ============ 后台分析导出 ============
const T_AN = '后台分析导出'
set('/api/admin/analytics/visitors/export', 'get', {
  ...op(T_AN, '导出访客 / 访问记录 CSV', {
    parameters: [
      { name: 'type', in: 'query', schema: { type: 'string', enum: ['visitors', 'visits'] }, allowEmptyValue: true, description: '导出维度。' },
      { name: 'from', in: 'query', schema: { type: 'string', format: 'date' }, allowEmptyValue: true },
      { name: 'to', in: 'query', schema: { type: 'string', format: 'date' }, allowEmptyValue: true },
    ],
    responses: { 200: { description: 'UTF-8 BOM CSV。', content: { 'text/csv': { schema: { $ref: '#/components/schemas/AnalyticsCsvExport' } } } } },
  }),
})

// ============ 后台工具 ============
const T_TOOL = '后台工具'
set('/api/admin/validate-css', 'post', {
  ...op(T_TOOL, '校验主题 CSS 安全规则', {
    requestBody: { required: true, description: '待校验 CSS。', content: { 'application/json': { schema: { type: 'object', required: ['css'], properties: { css: { type: 'string' } } } } } },
    responses: { 200: jsonOkInline({ valid: { type: 'boolean' }, errors: { type: 'array', items: { type: 'string' } } }, '校验结果。') },
  }),
})

// ============ 公开访问 ============
const T_PUB = '公开访问'
set('/api/analytics/events', 'post', {
  ...publicOp(T_PUB, '上报访问事件（sendBeacon，pagehide/visibilitychange）', {
    requestBody: jsonBody('#/components/schemas/AnalyticsEventInput'),
    responses: { 202: jsonOk('#/components/schemas/AnalyticsEventReceipt', '已接受。') },
  }),
})
set('/api/comments', 'post', {
  ...publicOp(T_PUB, '提交访客评论（进入审核流程）', {
    requestBody: jsonBody('#/components/schemas/CommentInput'),
    responses: { 201: jsonOk('#/components/schemas/PublicCommentReceipt'), 400: std400, 429: { description: '触发限流。' }, 500: std500 },
  }),
})
set('/api/health', 'get', {
  ...publicOp(T_PUB, '健康检查', {
    responses: { 200: jsonOkInline({ status: { type: 'string' } }, '存活状态。') },
  }),
})
set('/api/search', 'get', {
  ...publicOp(T_PUB, '公开搜索（空格或 + 拆分多关键词，全部命中）', {
    parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }, p('Page'), p('PageSize')],
    responses: { 200: jsonOkInline({ items: { type: 'array', items: { $ref: '#/components/schemas/PublicArticleSummary' } }, meta: { $ref: '#/components/schemas/PageMeta' } }) },
  }),
})
set('/api/themes/{name}/asset', 'get', {
  ...publicOp(T_PUB, '主题资源（CSS / JS / 图片），带版本指纹', {
    parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }, { name: 'path', in: 'query', required: true, schema: { type: 'string' } }, { name: 'v', in: 'query', schema: { type: 'string' }, allowEmptyValue: true }],
    responses: { 200: { description: '主题资源文件。', content: { '*/*': { schema: { type: 'string', format: 'binary' } } } }, 404: std404 },
  }),
})

// ============ 认证（Auth.js 标准） ============
const T_AUTH = '认证'
function authOp(summary, responses = { 200: std200 }) {
  return { tags: [T_AUTH], summary, responses }
}
set('/api/auth/csrf', 'get', authOp('获取 CSRF token'))
set('/api/auth/session', 'get', authOp('获取当前会话'))
set('/api/auth/providers', 'get', authOp('列出认证 provider'))
set('/api/auth/signin', 'post', authOp('管理员登录（Credentials Provider）', { 200: std200, 401: std401 }))
set('/api/auth/signout', 'post', authOp('登出'))
set('/api/auth/callback/credentials', 'post', authOp('Credentials 回调'))
set('/api/auth/error', 'get', authOp('认证错误页'))

// ============ 内容分发（非 /api，运行时端点） ============
const T_DIST = '内容分发'
set('/robots.txt', 'get', { tags: [T_DIST], summary: 'robots.txt（禁用 /admin，指向 sitemap）', responses: { 200: { description: 'text/plain。', content: { 'text/plain': { schema: { type: 'string' } } } } } })
set('/sitemap.xml', 'get', { tags: [T_DIST], summary: '动态站点地图（首页 / 文章 / 分类 / 标签）', responses: { 200: { description: 'application/xml。', content: { 'application/xml': { schema: { type: 'string' } } } } } })
set('/rss.xml', 'get', { tags: [T_DIST], summary: 'RSS feed（已发布文章倒序）', responses: { 200: { description: 'application/rss+xml。', content: { 'application/rss+xml': { schema: { type: 'string' } } } } } })

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'SeanBlog Frame 后端 API',
    version: '0.1.0',
    description: 'SeanBlog Frame 后端 API 的 OpenAPI 规范。项目采用单管理员模式：公开接口无需认证，/api/admin/* 接口需要有效的 Auth.js 会话 Cookie。文章 Markdown 保存在 content/articles/{articleId}/index.md；PostgreSQL 保存文章元数据与相对内容路径。前台公开页面由 (public) 路由组通过 Handlebars 主题模板渲染为 HTML，不在本规范内。',
  },
  servers: prev.servers,
  tags: TAGS,
  components: prev.components,
  paths,
}

writeFileSync(new URL('../docs/openapi.json', import.meta.url), JSON.stringify(spec, null, 2) + '\n')
console.log('paths:', Object.keys(paths).length)
console.log('operations:', Object.values(paths).reduce((n, m) => n + Object.keys(m).length, 0))
