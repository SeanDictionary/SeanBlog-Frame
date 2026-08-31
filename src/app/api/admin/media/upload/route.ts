import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { badRequest } from '@/lib/api/errors'
import { created, handleApiError } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { categorizeMimeType, fallbackExtension } from '@/lib/media-category'
import { adminLogActor, recordOperation } from '@/lib/services/operation-log-service'
import { createMedia } from '@/lib/services/media-service'

export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

function sanitizeExtension(extension: string) {
  const cleaned = extension.toLowerCase().replace(/[^a-z0-9]/g, '')
  return cleaned.slice(0, 16)
}

function resolveExtension(filename: string, mimeType: string) {
  const original = path.extname(filename)
  const cleaned = sanitizeExtension(original)
  if (cleaned) return cleaned
  return fallbackExtension(mimeType)
}

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

async function writeUniqueFile(uploadDirectory: string, desiredFilename: string, bytes: Buffer) {
  const parsed = path.parse(desiredFilename)
  const basename = parsed.name
  const extension = parsed.ext

  for (let index = 0; index < 1000; index += 1) {
    const filename = index === 0 ? desiredFilename : `${basename}-${index + 1}${extension}`

    try {
      await writeFile(path.join(uploadDirectory, filename), bytes, { flag: 'wx' })
      return filename
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }

  throw badRequest('Unable to allocate a unique upload filename.', 'UPLOAD_FILENAME_CONFLICT')
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

        const category = categorizeMimeType(file.type)
        const extension = resolveExtension(file.name, file.type)
        const basename = normalizeBasename(file.name, 'file')
        const desiredFilename = extension ? `${basename}.${extension}` : basename
        const bytes = Buffer.from(await file.arrayBuffer())
        const uploadDirectory = path.join(process.cwd(), 'public', 'uploads', 'media', category)

        await mkdir(uploadDirectory, { recursive: true })

        const filename = await writeUniqueFile(uploadDirectory, desiredFilename, bytes)
        const key = `uploads/media/${category}/${filename}`
        const url = `/${key}`

        writtenFiles.push(path.join(uploadDirectory, filename))

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
