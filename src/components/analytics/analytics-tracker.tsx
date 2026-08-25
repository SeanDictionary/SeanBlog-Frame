'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const visitorStorageKey = 'seanblog:analytics-visitor-id'
const sessionStorageKey = 'seanblog:analytics-session-id'

function getOrCreateStorageValue(storage: Storage, key: string) {
  const existing = storage.getItem(key)
  if (existing) return existing

  const value = crypto.randomUUID()
  storage.setItem(key, value)
  return value
}

function getContent(path: string) {
  const articleMatch = path.match(/^\/articles\/([^/]+)/)
  if (articleMatch) return { contentType: 'article', slug: decodeURIComponent(articleMatch[1]) }

  const categoryMatch = path.match(/^\/categories\/([^/]+)/)
  if (categoryMatch) return { contentType: 'category', slug: decodeURIComponent(categoryMatch[1]) }

  const tagMatch = path.match(/^\/tags\/([^/]+)/)
  if (tagMatch) return { contentType: 'tag', slug: decodeURIComponent(tagMatch[1]) }

  return { contentType: 'page', slug: null }
}

function getHardwareSummary() {
  const data: Record<string, number> = {
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  }
  if (typeof navigator.hardwareConcurrency === 'number') {
    data.cores = navigator.hardwareConcurrency
  }
  if ('deviceMemory' in navigator && typeof navigator.deviceMemory === 'number') {
    data.memory = navigator.deviceMemory
  }
  return JSON.stringify(data)
}

function getFingerprintSource() {
  return JSON.stringify({
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
  })
}

function sendAnalyticsEvent(path: string, startedAt: number, referrer: string) {
  const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000))
  const content = getContent(path)
  const payload = {
    path,
    ...content,
    visitorId: getOrCreateStorageValue(window.localStorage, visitorStorageKey),
    sessionId: getOrCreateStorageValue(window.sessionStorage, sessionStorageKey),
    referrer: referrer || null,
    browserFingerprint: getFingerprintSource(),
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

    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  return null
}
