// Client-side identity helpers shared by the analytics tracker, the comment
// form (visitor id) and the admin operation-log fetch wrapper (browser
// fingerprint / hardware). All functions touch browser globals and must only
// be called from client components.

const VISITOR_STORAGE_KEY = 'seanblog:analytics-visitor-id'

export function getVisitorId(): string | null {
  if (typeof window === 'undefined') return null

  const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY)
  if (existing) return existing

  const value = crypto.randomUUID()
  window.localStorage.setItem(VISITOR_STORAGE_KEY, value)
  return value
}

export function getBrowserFingerprint(): string {
  return JSON.stringify({
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
  })
}

export function getHardwareSummary(): string {
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
