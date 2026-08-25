'use client'

import { useEffect } from 'react'

import { getBrowserFingerprint, getHardwareSummary } from '@/lib/client/identity'

// Sets browser fingerprint and hardware cookies on mount so that every
// same-origin admin API request automatically carries them. The operation
// log service reads `sb-fp` / `sb-hw` from the Cookie header and stores
// them alongside ipAddress / userAgent (always collected, not gated by
// the analytics privacy toggles).
export function AdminIdentityBootstrap() {
  useEffect(() => {
    const maxAge = 60 * 60 * 24 * 365 // 1 year
    const flags = `path=/; max-age=${maxAge}; SameSite=Lax`
    document.cookie = `sb-fp=${encodeURIComponent(getBrowserFingerprint())}; ${flags}`
    document.cookie = `sb-hw=${encodeURIComponent(getHardwareSummary())}; ${flags}`
  }, [])

  return null
}
