import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { badRequest } from '@/lib/api/errors'
import { created, handleApiError } from '@/lib/api/response'
import { requireSameOriginRequest } from '@/lib/api/request-guard'
import { requireAdmin } from '@/lib/auth.utils'
import { createMedia } from '@/lib/services/media-service'

export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const imageExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

function getImageExtension(mimeType: string) {
  const extension = imageExtensions[mimeType]

  if (!extension) {
    throw badRequest('Only image uploads are supported.', 'UNSUPPORTED_MEDIA_TYPE')
  }

  return extension
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    requireSameOriginRequest(request)

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      throw badRequest('Image file is required.', 'MISSING_FILE')
    }

    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      throw badRequest('Image file must be between 1 byte and 5 MB.', 'INVALID_FILE_SIZE')
    }

    const extension = getImageExtension(file.type)
    const uploadDirectory = path.join(process.cwd(), 'public', 'uploads', 'media')
    const filename = `${Date.now()}-${randomUUID()}.${extension}`
    const key = `uploads/media/${filename}`
    const url = `/${key}`
    const bytes = Buffer.from(await file.arrayBuffer())

    await mkdir(uploadDirectory, { recursive: true })
    await writeFile(path.join(uploadDirectory, filename), bytes)

    const media = await createMedia({
      filename: file.name || filename,
      key,
      url,
      size: file.size,
      mimeType: file.type,
    })

    return created({ media })
  } catch (error) {
    return handleApiError(error)
  }
}
