'use client'

import { ErrorFallback } from '@/components/common/error-fallback'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorFallback error={error} reset={reset} variant="root" />
}
