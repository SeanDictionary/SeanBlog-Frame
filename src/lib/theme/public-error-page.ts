/**
 * 前台 Route Handler 的静态回退页。
 *
 * 前台页面是返回整页 HTML 的 Route Handler，不走 React 渲染管线，
 * 因此 `src/app/error.tsx` 边界无法捕获其抛出的错误。当数据库不可用
 * 等异常冒泡到这里时，由本工具生成一个自包含的静态 HTML 错误页，
 * 保证「永不白屏」并给出可排查的错误码。
 *
 * 回退页不依赖数据库/主题引擎（主题 CSS bundle 也要查 DB 才能生成），
 * 因此样式直接内联，复用默认主题的 token 与 ErrorFallback 的文案风格。
 */

import { getDatabaseErrorCode, isDatabaseError } from '@/lib/database-errors'

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

type ErrorPageKind = 'database' | 'internal'

function classifyError(error: unknown): { kind: ErrorPageKind; code: string; status: number } {
  if (isDatabaseError(error)) {
    return { kind: 'database', code: getDatabaseErrorCode(error), status: 503 }
  }
  return { kind: 'internal', code: 'INTERNAL_SERVER_ERROR', status: 500 }
}

const STYLES = `
  :root{
    --bg:#fff;--bg-secondary:#f5f5f5;--text:#1a1a1a;--text-secondary:#525252;
    --text-tertiary:#a3a3a3;--border:#e5e5e5;--accent:#2563eb;--accent-hover:#1d4ed8;
  }
  @media (prefers-color-scheme: dark){
    :root{--bg:#0a0a0a;--bg-secondary:#141414;--text:#ededed;--text-secondary:#a3a3a3;
      --text-tertiary:#525252;--border:#262626;--accent:#3b82f6;--accent-hover:#60a5fa;}
  }
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);
    color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;
    padding:1.25rem}
  main{max-width:28rem;width:100%;text-align:center}
  .code{font-family:ui-monospace,monospace;font-size:.875rem;color:var(--text-tertiary)}
  h1{margin:1rem 0 0;font-size:1.875rem;font-weight:600;letter-spacing:-.04em;line-height:1.2}
  p{margin:1rem 0 0;line-height:1.75;color:var(--text-secondary)}
  .actions{margin-top:2rem;display:flex;flex-wrap:wrap;gap:.75rem;justify-content:center}
  a,button{display:inline-block;text-decoration:none;font-size:.875rem;font-weight:500;
    padding:.5rem 1rem;border-radius:.25rem;cursor:pointer;border:1px solid var(--border);
    color:var(--text);background:transparent;transition:background-color .15s}
  button.primary,a.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
  button.primary:hover,a.primary:hover{background:var(--accent-hover);border-color:var(--accent-hover)}
  a:hover{background:var(--bg-secondary)}
`

function buildErrorHtml(error: unknown): { html: string; status: number } {
  const { kind, code, status } = classifyError(error)
  const isDatabase = kind === 'database'
  const title = isDatabase ? '页面暂时无法加载' : '出了点问题'
  const message = isDatabase
    ? '服务暂时不可用，请稍后重试。'
    : '出了点问题，请稍后重试，或返回首页继续浏览。'

  // 错误详情仅在服务端日志输出，避免向客户端泄露堆栈
  console.error(`[public] ${code} — route handler fallback`, error)

  const body = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
  <p class="code">${status} · ${esc(code)}</p>
  <h1>${esc(title)}</h1>
  <p>${esc(message)}</p>
  <div class="actions">
    <button type="button" class="primary" onclick="location.reload()">重试</button>
    <a href="/" class="">返回首页</a>
  </div>
</main>
</body>
</html>`

  return { html: body, status }
}

/**
 * 构造前台错误回退响应。DB 错误 → 503，其他 → 500。
 */
export function publicErrorResponse(error: unknown): Response {
  const { html, status } = buildErrorHtml(error)
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
