/** Display helpers. Values already carry units from callers. */

export function formatNumber(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatPowerFactor(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return value.toFixed(2)
}

export function formatTimestamp(iso: string, timeZone = 'Asia/Kolkata'): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function formatTimeOnly(iso: string, timeZone = 'Asia/Kolkata'): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function relativeAge(iso: string, now = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return 'unknown age'
  const sec = Math.max(0, Math.floor(ms / 1000))
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ago`
}
