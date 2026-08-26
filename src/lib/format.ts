// --- Date / time formatters ---

// Full date + time, e.g. 2026/08/26 14:30 (used in operation logs).
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '暂无记录'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '暂无记录'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d)
}

// Short date + time, e.g. 26/08/26 14:30 (used in visitor lists/tables).
export function formatDateTimeShort(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

// Date only, e.g. 2026年8月26日 (used in article cards, comments).
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

// Date only (compact), e.g. 2026/08/26 (used in article management table).
export function formatDateCompact(date: Date | string | null | undefined): string {
  if (!date) return '未设置'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '未设置'
  return d.toLocaleDateString('zh-CN')
}

// Month + day + time only, e.g. 08/26 14:30 (used in article editor timestamps).
export function formatMonthDayTime(date: Date | string | null | undefined): string {
  if (!date) return '暂无记录'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '暂无记录'
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
