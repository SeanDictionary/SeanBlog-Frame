const DURATION_UNITS = [
  { unit: 86400, short: 'd', full: '天' },
  { unit: 3600, short: 'h', full: '时' },
  { unit: 60, short: 'm', full: '分' },
  { unit: 1, short: 's', full: '秒' },
] as const

// List view: only the two largest non-zero units (e.g. 1h35m, 12d34h, 5s).
export function formatDurationShort(seconds: number | null) {
  if (seconds === null) return '未采集'
  let remaining = Math.max(0, Math.round(seconds))
  const parts: string[] = []
  for (const { unit, short } of DURATION_UNITS) {
    const value = Math.floor(remaining / unit)
    remaining %= unit
    if (value > 0 && parts.length < 2) parts.push(`${value}${short}`)
  }
  return parts.length ? parts.join('') : '0s'
}

// Detail view: the full breakdown (e.g. 1 时 35 分 48 秒).
export function formatDurationFull(seconds: number | null) {
  if (seconds === null) return '未采集'
  let remaining = Math.max(0, Math.round(seconds))
  const parts: string[] = []
  for (const { unit, full } of DURATION_UNITS) {
    const value = Math.floor(remaining / unit)
    remaining %= unit
    if (value > 0) parts.push(`${value} ${full}`)
  }
  return parts.length ? parts.join(' ') : '0 秒'
}
