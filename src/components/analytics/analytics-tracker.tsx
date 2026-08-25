'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import { getBrowserFingerprint, getHardwareSummary, getVisitorId } from '@/lib/client/identity'

function getContent(path: string) {
  const articleMatch = path.match(/^\/articles\/([^/]+)/)
  if (articleMatch) return { contentType: 'article', slug: decodeURIComponent(articleMatch[1]) }

  const categoryMatch = path.match(/^\/categories\/([^/]+)/)
  if (categoryMatch) return { contentType: 'category', slug: decodeURIComponent(categoryMatch[1]) }

  const tagMatch = path.match(/^\/tags\/([^/]+)/)
  if (tagMatch) return { contentType: 'tag', slug: decodeURIComponent(tagMatch[1]) }

  return { contentType: 'page', slug: null }
}

function sendAnalyticsEvent(path: string, startedAt: number, referrer: string) {
  const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000))
  const content = getContent(path)
  const payload = {
    path,
    ...content,
    visitorId: getVisitorId(),
    referrer: referrer || null,
    browserFingerprint: getBrowserFingerprint(),
    hardware: getHardwareSummary(),
    durationSeconds,
  }
  const body = JSON.stringify(payload)

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/events', new Blob([body], { type: 'application/json' }))
    return
  }

  void fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  })
}

export function AnalyticsTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentRef = useRef<{ path: string; startedAt: number; referrer: string } | null>(null)
  const fullPath = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ''}`

  useEffect(() => {
    const previous = currentRef.current
    if (previous) {
      sendAnalyticsEvent(previous.path, previous.startedAt, previous.referrer)
    }

    currentRef.current = {
      path: fullPath,
      startedAt: Date.now(),
      referrer: document.referrer,
    }
  }, [fullPath])

  useEffect(() => {
    function flush() {
      const current = currentRef.current
      if (!current) return
      sendAnalyticsEvent(current.path, current.startedAt, current.referrer)
      currentRef.current = null
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') flush()
    }

    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      flush()
    }
  }, [])

  return null
}
