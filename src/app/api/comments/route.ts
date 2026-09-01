import { created, handleApiError, parseJson } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { ApiError } from '@/lib/api/errors'
import { createComment } from '@/lib/services/comment-service'
import { commentInputSchema } from '@/lib/validations/cms'

export async function POST(request: Request) {
  try {
    // 评论是未认证但会改变 DB 状态的写入，校验同源避免跨站表单 CSRF。
    requireSameOriginRequest(request)
    const body = await parseJson(request)
    const input = commentInputSchema.parse(body)

    try {
      const comment = await createComment(input, request)
      return created({ comment })
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        throw error
      }
      throw error
    }
  } catch (error) {
    return handleApiError(error)
  }
}
