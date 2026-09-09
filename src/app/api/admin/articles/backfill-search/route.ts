import { badRequest } from '@/lib/api/errors'
import { handleApiError, json } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { backfillArticleSearchContent } from '@/lib/services/article-service'

export const runtime = 'nodejs'

// 0.5.0 之前导入的文章缺 contentHtml / searchText，升级后调一次本接口原地补齐。
// 详情见 backfillArticleSearchContent 的注释。幂等，仅 admin 可调。
export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const url = new URL(request.url)
    const force = url.searchParams.get('force') === '1'
    const limitRaw = url.searchParams.get('limit')
    let limit: number | undefined
    if (limitRaw) {
      const n = Number(limitRaw)
      if (!Number.isInteger(n) || n <= 0) {
        throw badRequest('limit must be a positive integer.', 'INVALID_LIMIT')
      }
      limit = n
    }

    const result = await recordOperation({
      actor: adminLogActor(session),
      module: 'article',
      action: 'backfill',
      targetType: 'article',
      summary: (r) => `回填搜索内容：处理 ${r.processed} 篇，跳过 ${r.skipped} 篇${r.errored ? `，失败 ${r.errored} 篇` : ''}${force ? '（全量重渲染）' : ''}`,
      failureSummary: '回填搜索内容失败',
      metadata: (r) => ({ force, ...r }),
      request,
    }, () => backfillArticleSearchContent({ force, limit }))

    return json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
