// 媒体文件分类：前后端共用。后端按此分类决定存储子目录，
// 前端按此分类展示图标与筛选标签。纯函数、无依赖、isomorphic。

export type MediaCategory = 'images' | 'videos' | 'audio' | 'documents' | 'archives' | 'other'

export const MEDIA_CATEGORIES: Array<{ key: MediaCategory; label: string; icon: string }> = [
  { key: 'images', label: '图片', icon: 'fa-regular fa-image' },
  { key: 'videos', label: '视频', icon: 'fa-solid fa-film' },
  { key: 'audio', label: '音频', icon: 'fa-solid fa-music' },
  { key: 'documents', label: '文档', icon: 'fa-regular fa-file-lines' },
  { key: 'archives', label: '压缩包', icon: 'fa-solid fa-file-zipper' },
  { key: 'other', label: '其他', icon: 'fa-regular fa-file' },
]

const archiveMimeTypes = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-bzip2',
  'application/x-xz',
  'application/x-9z-compressed',
])

const documentMimeTypes = new Set([
  'application/pdf',
  'application/rtf',
  'application/msword',
  'application/json',
  'application/xml',
  'application/x-abiword',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.ms-word',
  'text/csv',
  'text/markdown',
])

export function categorizeMimeType(mimeType: string): MediaCategory {
  const mime = (mimeType || '').toLowerCase()

  if (mime.startsWith('image/')) return 'images'
  if (mime.startsWith('video/')) return 'videos'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('text/') && mime !== 'text/csv' && mime !== 'text/markdown') return 'documents'
  if (documentMimeTypes.has(mime)) return 'documents'
  if (archiveMimeTypes.has(mime)) return 'archives'

  return 'other'
}

export function categoryOf(mimeType: string): { key: MediaCategory; label: string; icon: string } {
  const key = categorizeMimeType(mimeType)
  return MEDIA_CATEGORIES.find((category) => category.key === key) ?? MEDIA_CATEGORIES[MEDIA_CATEGORIES.length - 1]
}

// MIME → 扩展名兜底：当原文件名没有扩展名时使用。
const fallbackExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/x-tar': 'tar',
  'application/gzip': 'gz',
  'application/json': 'json',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/markdown': 'md',
}

export function fallbackExtension(mimeType: string): string {
  return fallbackExtensions[(mimeType || '').toLowerCase()] ?? ''
}
