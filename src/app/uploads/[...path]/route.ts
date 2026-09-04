import { Readable } from 'node:stream'

import { NextResponse } from 'next/server'

import {
  contentTypeFor,
  createUploadReadStream,
  resolveUploadPath,
  statUpload,
} from '@/lib/media/storage'

/**
 * 服务用户上传的媒体文件。
 *
 * 不依赖 Next.js 的 `public/` 静态服务——生产模式下 `public/` 文件清单在启动时
 * 一次性缓存，运行时写入的文件不会被服务。改由本路由从存储根（默认
 * `<cwd>/storage/uploads`，容器内挂命名卷持久化）流式读取，URL 前缀 `/uploads/`
 * 不变。支持 Range 请求（视频/音频拖动）。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

type RouteContext = { params: Promise<{ path: string[] }> }

function notFound() {
  return new NextResponse('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
}

function rangeNotSatisfiable(size: number) {
  return new NextResponse('Range Not Satisfiable', {
    status: 416,
    headers: { 'Content-Range': `bytes */${size}`, 'Content-Type': 'text/plain' },
  })
}

function toWebStream(nodeStream: ReturnType<typeof createUploadReadStream>) {
  return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>
}

export async function GET(request: Request, context: RouteContext) {
  const { path: segments } = await context.params
  const absPath = resolveUploadPath(segments)
  if (!absPath) return notFound()

  const info = await statUpload(absPath)
  if (!info) return notFound()

  const contentType = contentTypeFor(absPath)
  const range = request.headers.get('range')

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
    if (match) {
      const start = match[1] ? Number.parseInt(match[1], 10) : 0
      const end = match[2] ? Number.parseInt(match[2], 10) : info.size - 1
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start > end ||
        start < 0 ||
        start >= info.size
      ) {
        return rangeNotSatisfiable(info.size)
      }
      const clampedEnd = Math.min(end, info.size - 1)
      const length = clampedEnd - start + 1
      const stream = createUploadReadStream(absPath, { start, end: clampedEnd })
      return new NextResponse(toWebStream(stream), {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(length),
          'Content-Range': `bytes ${start}-${clampedEnd}/${info.size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': CACHE_CONTROL,
        },
      })
    }
  }

  const stream = createUploadReadStream(absPath)
  return new NextResponse(toWebStream(stream), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(info.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': CACHE_CONTROL,
    },
  })
}

export async function HEAD(_request: Request, context: RouteContext) {
  const { path: segments } = await context.params
  const absPath = resolveUploadPath(segments)
  if (!absPath) return notFound()
  const info = await statUpload(absPath)
  if (!info) return notFound()
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': contentTypeFor(absPath),
      'Content-Length': String(info.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': CACHE_CONTROL,
    },
  })
}
