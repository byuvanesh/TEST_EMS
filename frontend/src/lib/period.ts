import type { EnergyPeriodPreset, PeriodBounds } from '@/types'

/** Anchor "now" for deterministic DEMO periods (IST). */
export const DEMO_ANCHOR = '2026-10-30T11:45:00+05:30'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Format a Date as +05:30 wall-clock ISO without converting TZ libraries. */
export function toIstIso(date: Date): string {
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}+05:30`
}

export function parseIstWall(iso: string): Date {
  // Treat +05:30 timestamps as local wall components for deterministic math.
  const m = iso.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/,
  )
  if (!m) return new Date(iso)
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  )
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

function formatDay(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export interface ResolvePeriodInput {
  preset: EnergyPeriodPreset
  customStart?: string
  customEnd?: string
  anchorIso?: string
}

export function resolvePeriodBounds(input: ResolvePeriodInput): PeriodBounds | null {
  const anchor = parseIstWall(input.anchorIso ?? DEMO_ANCHOR)

  if (input.preset === 'custom') {
    if (!input.customStart || !input.customEnd) return null
    const start = startOfDay(parseIstWall(`${input.customStart}T00:00:00+05:30`))
    const end = endOfDay(parseIstWall(`${input.customEnd}T00:00:00+05:30`))
    if (end < start) return null
    return {
      preset: 'custom',
      start: toIstIso(start),
      end: toIstIso(end),
      label: `${formatDay(start)} – ${formatDay(end)}`,
    }
  }

  if (input.preset === 'today') {
    const start = startOfDay(anchor)
    const end = anchor
    return {
      preset: 'today',
      start: toIstIso(start),
      end: toIstIso(end),
      label: `Today · ${formatDay(anchor)}`,
    }
  }

  if (input.preset === 'yesterday') {
    const day = addDays(startOfDay(anchor), -1)
    return {
      preset: 'yesterday',
      start: toIstIso(day),
      end: toIstIso(endOfDay(day)),
      label: `Yesterday · ${formatDay(day)}`,
    }
  }

  if (input.preset === '7d') {
    const end = anchor
    const start = startOfDay(addDays(anchor, -6))
    return {
      preset: '7d',
      start: toIstIso(start),
      end: toIstIso(end),
      label: `Last 7 days · ${formatDay(start)} – ${formatDay(end)}`,
    }
  }

  // this month
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0)
  return {
    preset: 'month',
    start: toIstIso(start),
    end: toIstIso(anchor),
    label: `This month · ${formatDay(start)} – ${formatDay(anchor)}`,
  }
}

export function previousPeriodBounds(current: PeriodBounds): PeriodBounds {
  const start = parseIstWall(current.start)
  const end = parseIstWall(current.end)

  if (current.preset === 'today') {
    const prevStart = addDays(start, -1)
    const prevEnd = addDays(end, -1)
    return {
      preset: 'today',
      start: toIstIso(prevStart),
      end: toIstIso(prevEnd),
      label: `Yesterday (same elapsed window) · ${formatDay(prevStart)}`,
    }
  }

  if (current.preset === 'yesterday') {
    const prevStart = addDays(start, -1)
    const prevEnd = addDays(end, -1)
    return {
      preset: 'yesterday',
      start: toIstIso(prevStart),
      end: toIstIso(prevEnd),
      label: `Day before yesterday · ${formatDay(prevStart)}`,
    }
  }

  if (current.preset === '7d') {
    const prevStart = addDays(start, -7)
    const prevEnd = addDays(end, -7)
    return {
      preset: '7d',
      start: toIstIso(prevStart),
      end: toIstIso(prevEnd),
      label: `Prior 7 days (same elapsed window)`,
    }
  }

  if (current.preset === 'month') {
    const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1, 0, 0, 0)
    const prevEnd = new Date(
      start.getFullYear(),
      start.getMonth() - 1,
      end.getDate(),
      end.getHours(),
      end.getMinutes(),
      end.getSeconds(),
    )
    return {
      preset: 'month',
      start: toIstIso(prevStart),
      end: toIstIso(prevEnd),
      label: `Prior month (same elapsed window)`,
    }
  }

  const durationMs = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime() - 1000)
  const prevStart = new Date(prevEnd.getTime() - durationMs)

  return {
    preset: current.preset,
    start: toIstIso(prevStart),
    end: toIstIso(prevEnd),
    label: `Previous · ${formatDay(prevStart)} – ${formatDay(prevEnd)}`,
  }
}

export function hoursBetween(startIso: string, endIso: string): number {
  const start = parseIstWall(startIso)
  const end = parseIstWall(endIso)
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 3_600_000) + 1)
}

/**
 * Incomplete calendar window: ends before end-of-day (e.g. Today, open month, 7d ending at anchor).
 * Yesterday (full day) is not partial.
 */
export function isPartialPeriod(period: PeriodBounds): boolean {
  const end = parseIstWall(period.end)
  const dayEnd = endOfDay(end)
  return end.getTime() < dayEnd.getTime()
}

export function partialPeriodMessage(period: PeriodBounds): string | null {
  if (!isPartialPeriod(period)) return null
  if (period.preset === 'today') {
    return 'Incomplete day: figures cover midnight through the DEMO snapshot time only — not a full calendar day.'
  }
  if (period.preset === 'month') {
    return 'Incomplete month: figures cover month start through the DEMO snapshot time only.'
  }
  if (period.preset === '7d') {
    return 'Incomplete final day: the last day in this window ends at the DEMO snapshot time, not 23:59.'
  }
  return 'Incomplete period: the selected end time is before end of day — not a completed full-day total.'
}
