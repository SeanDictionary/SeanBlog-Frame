import { rm } from 'node:fs/promises'
import path from 'node:path'

import { badRequest } from '@/lib/api/errors'
import { created, handleApiError } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { resolveMediaUpload } from '@/lib/media-category'
import { writeUniqueFile } from '@/lib/media/storage'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { createMedia } from '@/lib/services/media-service'

export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

function normalizeBasename(filename: string, fallback: string) {
  const parsed = path.parse(filename || fallback)
  const name = parsed.name
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|[\s.]+$/g, '')
    .trim()
    .slice(0, 120)

  return name || fallback
}

export async function POST(request: Request) {
  const writtenFiles: string[] = []

  try {
    const session = await requireAdmin()
    requireSameOriginRequest(request)

    const result = await recordOperation({
      actor: adminLogActor(session),
      module: 'media',
      action: 'upload',
      targetType: 'media',
      summary: (operationResult) => `上传 ${operationResult.mediaItems.length} 个媒体文件`,
      failureSummary: '上传媒体文件失败',
      metadata: (operationResult) => ({ ids: operationResult.mediaItems.map((media) => media.id), filenames: operationResult.mediaItems.map((media) => media.filename) }),
      request,
    }, async () => {
      const formData = await request.formData()
      const files = formData.getAll('file')

      if (!files.length || !files.every((file): file is File => file instanceof File)) {
        throw badRequest('At least one file is required.', 'MISSING_FILE')
      }

      const uploaded = []

      for (const file of files) {
        if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
          throw badRequest('文件大小需在 1 字节至 50 MB 之间。', 'INVALID_FILE_SIZE')
        }

        const bytes = Buffer.from(await file.arrayBuffer())
        const { category, extension } = resolveMediaUpload(file.name, file.type, bytes)
        const basename = normalizeBasename(file.name, 'file')
        const desiredFilename = `${basename}.${extension}`
        const dirRel = path.posix.join('media', category)

        const { filename, absPath } = await writeUniqueFile(dirRel, desiredFilename, bytes)
        const key = `${dirRel}/${filename}`
        const url = `/uploads/${key}`

        writtenFiles.push(absPath)

        const media = await createMedia({
          filename,
          key,
          url,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
        })
        uploaded.push(media)
      }

      return { media: uploaded[0], mediaItems: uploaded }
    })

    return created(result)
  } catch (error) {
    await Promise.all(writtenFiles.map((filePath) => rm(filePath, { force: true }).catch(() => undefined)))
    return handleApiError(error)
  }
}
