'use client'

import { ErrorFallback } from '@/components/common/error-fallback'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">
        <ErrorFallback error={error} reset={reset} variant="root" />
      </body>
    </html>
  )
}
