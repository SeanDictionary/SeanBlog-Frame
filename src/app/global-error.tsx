'use client'

import Link from 'next/link'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

function getErrorCode(error: Error & { digest?: string }) {
  if (/database|prisma|connection|ECONNREFUSED|Can't reach database|DATABASE_URL/i.test(error.message)) {
    return 'DATABASE_UNAVAILABLE'
  }

  return error.digest ? `ERROR_${error.digest}` : 'INTERNAL_SERVER_ERROR'
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  const code = getErrorCode(error)
  const isDatabaseError = code === 'DATABASE_UNAVAILABLE'

  return (
    <html lang="zh-CN">
      <body className="grid min-h-screen place-items-center bg-neutral-50 px-5 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
        <main className="max-w-md text-center">
          <p className="font-mono text-sm text-neutral-500">500 · {code}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">页面暂时无法加载</h1>
          <p className="mt-4 leading-7 text-neutral-600 dark:text-neutral-400">
            {isDatabaseError
              ? '数据库暂时不可用。请检查 PostgreSQL 容器状态、DATABASE_URL 配置和迁移是否已应用，然后重试。'
              : '我们已经记录了这次异常。你可以重试，或返回首页继续阅读。'}
          </p>
          <div className="mt-8 flex justify-center gap-4"><button type="button" onClick={reset} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950">重试</button><Link href="/" className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">返回首页</Link></div>
        </main>
      </body>
    </html>
  )
}
