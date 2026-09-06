import { renderNotFoundResponse } from '@/lib/theme/render-service'

export const dynamic = 'force-dynamic'

// 兜底 catch-all：所有未匹配到更具体路由的前台路径（含真正不存在的路径）
// 都在这里返回 404。主题提供 404.hbs 时走主题模板，否则回退到平台内置 404 页。
// 选用必选 catch-all [...path]（而非 [[...path]]）是为了不与根 route.ts（首页 /）冲突。
export async function GET() {
  return renderNotFoundResponse()
}
