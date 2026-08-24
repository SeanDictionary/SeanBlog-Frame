'use client'

import Link from 'next/link'

type ErrorFallbackProps = {
  error: Error & { digest?: string }
  reset: () => void
  /**
   * Controls the surrounding chrome so the fallback matches the segment it
   * renders in. `public` sits inside the site shell, `admin` inside the admin
   * shell, `root` is a standalone fallback under the root layout.
   */
  variant?: 'public' | 'admin' | 'root'
}

const DATABASE_ERROR_REGEX =
  /database|prisma|connection|ECONNREFUSED|Can't reach database|DATABASE_URL|invocation/i

function getErrorCode(error: Error & { digest?: string }) {
  if (DATABASE_ERROR_REGEX.test(error.message)) {
    return 'DATABASE_UNAVAILABLE'
  }

  return error.digest ? `ERROR_${error.digest}` : 'INTERNAL_SERVER_ERROR'
}

export function ErrorFallback({ error, reset, variant = 'public' }: ErrorFallbackProps) {
  const code = getErrorCode(error)
  const isDatabaseError = code === 'DATABASE_UNAVAILABLE'
  const retryLabel = isDatabaseError ? '重试' : '重试'

  const content = (
    <div className="text-center">
      <p className="font-mono text-sm text-text-tertiary">500 · {code}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">页面暂时无法加载</h1>
      <p className="mt-4 leading-7 text-text-secondary">
        {isDatabaseError
          ? '服务暂时不可用，请稍后重试。'
          : '出了点问题，请稍后重试，或返回首页继续浏览。'}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          {retryLabel}
        </button>
        {variant !== 'root' && (
          <Link
            href={variant === 'admin' ? '/admin' : '/'}
            className="rounded-sm border border-border px-4 py-2 text-sm transition-colors hover:bg-bg-secondary"
          >
            {variant === 'admin' ? '返回后台首页' : '返回首页'}
          </Link>
        )}
        {variant === 'root' && (
          <Link
            href="/"
            className="rounded-sm border border-border px-4 py-2 text-sm transition-colors hover:bg-bg-secondary"
          >
            返回首页
          </Link>
        )}
      </div>
    </div>
  )

  if (variant === 'admin') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-16">
        <div className="max-w-md">{content}</div>
      </div>
    )
  }

  if (variant === 'root') {
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-5 text-text">
        <main className="max-w-md">{content}</main>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-24">{content}</div>
  )
}
