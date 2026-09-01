// 媒体文件分类：前后端共用。后端按此分类决定存储子目录，
// 前端按此分类展示图标与筛选标签。纯函数、无依赖、isomorphic。

import { badRequest } from '@/lib/api/errors'

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

// --- 上传安全：扩展名白名单 + 危险内容签名检测 ---
// 静态托管下，.html/.svg/.js 等会被浏览器作为可执行内容渲染（同源 XSS），
// 故必须按扩展名白名单收口；再以字节签名检测改名伪装。

const DANGEROUS_EXTENSIONS = new Set([
  'html', 'htm', 'xhtml', 'svg', 'js', 'mjs', 'cjs', 'wasm', 'exe', 'msi', 'bat',
  'cmd', 'sh', 'ps1', 'php', 'phtml', 'php3', 'php4', 'jsp', 'jspx', 'asp', 'aspx',
  'asa', 'asax', 'cer', 'py', 'pl', 'rb', 'cgi', 'vbs', 'htaccess', 'jar', 'war',
  'class', 'swf', 'htc', 'odc', 'svgz',
])

const ALLOWED_EXTENSIONS_BY_CATEGORY: Record<MediaCategory, Set<string>> = {
  images: new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico']),
  videos: new Set(['mp4', 'webm', 'mov', 'mkv', 'ogv']),
  audio: new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus']),
  documents: new Set(['pdf', 'txt', 'csv', 'md', 'json', 'xml', 'rtf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp']),
  archives: new Set(['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar']),
  other: new Set(['pdf', 'txt', 'csv', 'md', 'json', 'xml']), // other 类只放明显无害类型
}

/** 常见可执行 / 脚本内容的字节签名，用于拦改名伪装（不论声明的扩展名）。 */
function looksLikeDangerousContent(bytes: Buffer): boolean {
  if (bytes.length < 4) return false
  // HTML / XML / SVG / 脚本首字节
  const head = bytes.subarray(0, 32).toString('latin1')
  if (/^\s*<(!doctype|html|svg|\?xml|script)/i.test(head)) return true
  if (head.startsWith('#!')) return true // shell 脚本
  // MZ -> PE 可执行（Windows .exe/.dll）
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return true
  // ELF 可执行
  if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return true
  return false
}

/** 上传解析：由 MIME 确定分类，由文件名取扩展名，校验白名单与危险内容。 */
export function resolveMediaUpload(filename: string, mimeType: string, bytes: Buffer): { category: MediaCategory; extension: string } {
  const category = categorizeMimeType(mimeType)
  const rawExt = filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1) : ''
  const extension = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16)

  if (!extension) {
    throw badRequest('File must have a recognized extension.', 'INVALID_FILE_TYPE')
  }

  if (DANGEROUS_EXTENSIONS.has(extension)) {
    throw badRequest(`Uploading .${extension} files is not allowed.`, 'INVALID_FILE_TYPE')
  }

  const allowed = ALLOWED_EXTENSIONS_BY_CATEGORY[category]
  if (!allowed.has(extension)) {
    throw badRequest(`File extension .${extension} is not allowed for this category.`, 'INVALID_FILE_TYPE')
  }

  if (looksLikeDangerousContent(bytes)) {
    throw badRequest('File content looks like an executable or markup document and was rejected.', 'INVALID_FILE_CONTENT')
  }

  return { category, extension }
}
