import { json } from '@/lib/api/response'

// API 兜底：未匹配到的 /api/** 路径返回 JSON 404，避免被前台 [...path] 兜底
// 抢占而返回 HTML 错误页（破坏 API 客户端的 JSON 契约）。
export function GET() {
  return json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } }, { status: 404 })
}

export function POST() {
  return json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } }, { status: 404 })
}

export function PUT() {
  return json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } }, { status: 404 })
}

export function DELETE() {
  return json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } }, { status: 404 })
}

export function PATCH() {
  return json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } }, { status: 404 })
}
