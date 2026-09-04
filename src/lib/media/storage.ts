/**
 * 媒体上传存储层
 *
 * 把"用户上传文件住在哪里、怎么读写删"集中到一处。上传内容不再放进 Next.js 的
 * `public/`（生产模式下 `public/` 文件清单在启动时一次性缓存，运行时写入的文件
 * 不会被服务；且 `public/` 是构建期静态资源语义，不应承载运行时可变用户数据）。
 *
 * 默认存储根 `<cwd>/storage/uploads`，可由 `UPLOADS_DIR` 覆盖（容器内即
 * `/app/storage/uploads`，挂命名卷以持久化）。
 *
 * 服务端按 URL 路径读取文件（见 `src/app/uploads/[...path]/route.ts`），DB 的
 * `Media.key` 仅用于删除与未来对象存储（S3/R2/MinIO）接入——届时只需替换本模块的
 * write/read/delete 实现，URL 与数据模型不变。
 */

import { createReadStream } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { badRequest } from '@/lib/api/errors'

/** 上传文件存储根目录。 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ?? path.join(process.cwd(), 'storage', 'uploads')

const MIME_TYPES: Record<string, string> = {
  // images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  // video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.ogv': 'video/ogg',
  // audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  // documents
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.csv': 'text/csv',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.rtf': 'application/rtf',
  // archives
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.bz2': 'application/x-bzip2',
  '.xz': 'application/x-xz',
}

export function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

/**
 * 将相对路径段安全解析为 `UPLOADS_DIR` 内的绝对路径。
 * 任何越界（`..`、绝对路径、盘符）都返回 null。
 */
export function resolveUploadPath(segments: string[]): string | null {
  if (!segments.length) return null
  const resolved = path.resolve(UPLOADS_DIR, ...segments)
  if (resolved !== UPLOADS_DIR && !resolved.startsWith(UPLOADS_DIR + path.sep)) {
    return null
  }
  return resolved
}

/**
 * 从公开 URL（形如 `/uploads/media/images/x.jpg`）解析到磁盘绝对路径。
 * 非 `/uploads/` 前缀或越界返回 null。
 */
export function resolveUploadPathFromUrl(url: string): string | null {
  if (!url.startsWith('/uploads/')) return null
  const decoded = decodeURIComponent(url.split(/[?#]/)[0] ?? '')
  const rel = decoded.slice('/uploads/'.length).replace(/^\/+/, '')
  if (!rel) return null
  return resolveUploadPath(rel.split('/'))
}

/**
 * 将相对目录段解析为绝对目录，校验落在 `UPLOADS_DIR` 内。
 */
function resolveUploadDir(dirRel: string): string {
  const dirAbs = path.resolve(UPLOADS_DIR, dirRel)
  if (dirAbs !== UPLOADS_DIR && !dirAbs.startsWith(UPLOADS_DIR + path.sep)) {
    throw badRequest('Invalid upload directory.', 'INVALID_UPLOAD_DIR')
  }
  return dirAbs
}

/**
 * 原子写入文件：`flag:'wx'` 确保不覆盖既有文件；文件名冲突时自动追加序号。
 * 返回最终文件名与绝对路径。
 */
export async function writeUniqueFile(
  dirRel: string,
  desiredFilename: string,
  bytes: Buffer,
): Promise<{ filename: string; absPath: string }> {
  const dirAbs = resolveUploadDir(dirRel)
  await mkdir(dirAbs, { recursive: true })

  const parsed = path.parse(desiredFilename)
  const basename = parsed.name
  const extension = parsed.ext

  for (let index = 0; index < 1000; index += 1) {
    const filename = index === 0 ? desiredFilename : `${basename}-${index + 1}${extension}`
    try {
      const absPath = path.join(dirAbs, filename)
      await writeFile(absPath, bytes, { flag: 'wx' })
      return { filename, absPath }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }

  throw badRequest('Unable to allocate a unique upload filename.', 'UPLOAD_FILENAME_CONFLICT')
}

/** 读取上传文件元信息（大小、是否为普通文件）。不存在或非文件返回 null。 */
export async function statUpload(absPath: string): Promise<{ size: number; mtime: Date } | null> {
  try {
    const s = await stat(absPath)
    if (!s.isFile()) return null
    return { size: s.size, mtime: s.mtime }
  } catch {
    return null
  }
}

/** 创建读取流（支持 Range 起止）。 */
export function createUploadReadStream(absPath: string, opts?: { start?: number; end?: number }) {
  return createReadStream(absPath, opts)
}

/** 删除上传文件（按公开 URL 解析路径）；路径不合法或文件不存在均静默返回。 */
export async function deleteUploadByUrl(url: string): Promise<void> {
  const absPath = resolveUploadPathFromUrl(url)
  if (!absPath) return
  await rm(absPath, { force: true }).catch(() => undefined)
}
