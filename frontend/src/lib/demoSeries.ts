/**
 * Canonical DEMO telemetry series — single generator for Overview, Energy, Load Detail.
 *
 * DEMO convention only: when a sample is present, hourly active power (kW) × 1 hour ≈ kWh.
 * Missing samples are `null` (never coerced to 0). This is not meter-counter energy and
 * must never be reused for REAL telemetry derivation.
 */

import { ALL_LOAD_IDS } from '@/config/loads'
import { createSeededRandom, hashSeed } from '@/lib/seed'
import { DEMO_ANCHOR, parseIstWall, toIstIso } from '@/lib/period'
import type { DemoHourlySample, LoadId } from '@/types'

/** Earliest hour retained so month / previous-period windows are covered. */
export const DEMO_SERIES_START = '2026-09-01T00:00:00+05:30'

const BASE_KW: Record<LoadId, number> = {
  'AC-01': 3.2,
  'AC-02': 2.9,
  'AC-03': 4.8,
  'Compressor-01': 5.5,
}

function dayFactor(hour: number): number {
  return hour >= 8 && hour <= 20 ? 1 : 0.42
}

/** Deterministic hourly kW when a sample is present. */
export function demoPowerKw(loadId: LoadId, at: Date): number {
  const seed = hashSeed(`${loadId}|${toIstIso(at).slice(0, 13)}`)
  const rand = createSeededRandom(seed)
  const hour = at.getHours()
  const base = BASE_KW[loadId]
  const wobble = (rand() - 0.5) * 0.7
  return Number((base * dayFactor(hour) + wobble).toFixed(2))
}

/** ~4% deterministic gaps; first hour of any calendar day is never missing. */
export function isMissingDemoSample(at: Date): boolean {
  if (at.getHours() === 0) return false
  const coverageSeed = createSeededRandom(hashSeed(`cov|${toIstIso(at)}`))
  return coverageSeed() < 0.04
}

function floorToHour(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0)
}

function iterateHoursInclusive(start: Date, end: Date): Date[] {
  const hours: Date[] = []
  const cursor = floorToHour(start)
  const last = floorToHour(end)
  while (cursor <= last) {
    hours.push(new Date(cursor))
    cursor.setHours(cursor.getHours() + 1)
  }
  return hours
}

function buildSeriesRange(startIso: string, endIso: string): DemoHourlySample[] {
  const start = parseIstWall(startIso)
  const end = parseIstWall(endIso)
  return iterateHoursInclusive(start, end).map((at) => {
    const missing = isMissingDemoSample(at)
    const point: DemoHourlySample = {
      timestamp: toIstIso(at),
      hourLabel: `${String(at.getHours()).padStart(2, '0')}:00`,
      'AC-01': null,
      'AC-02': null,
      'AC-03': null,
      'Compressor-01': null,
    }
    if (!missing) {
      for (const loadId of ALL_LOAD_IDS) {
        point[loadId] = demoPowerKw(loadId, at)
      }
    }
    return point
  })
}

let cachedSeries: DemoHourlySample[] | null = null

/** Full canonical series from DEMO_SERIES_START through DEMO_ANCHOR (inclusive hour). */
export function getCanonicalDemoSeries(): DemoHourlySample[] {
  if (!cachedSeries) {
    cachedSeries = buildSeriesRange(DEMO_SERIES_START, DEMO_ANCHOR)
  }
  return cachedSeries
}

/** Test helper — clear memoization. */
export function resetCanonicalDemoSeriesCache(): void {
  cachedSeries = null
}

export function sliceSeries(
  series: DemoHourlySample[],
  startIso: string,
  endIso: string,
): DemoHourlySample[] {
  const start = parseIstWall(startIso).getTime()
  const end = parseIstWall(endIso).getTime()
  return series.filter((row) => {
    const t = parseIstWall(row.timestamp).getTime()
    return t >= start && t <= end
  })
}

export function sumLoadEnergyKwh(
  series: DemoHourlySample[],
  loadId: LoadId,
): number {
  let total = 0
  for (const row of series) {
    const v = row[loadId]
    if (v !== null && v !== undefined) total += v
  }
  return Number(total.toFixed(2))
}

export function sumSiteEnergyKwh(
  series: DemoHourlySample[],
  loads: LoadId[],
): number {
  let total = 0
  for (const loadId of loads) {
    total += sumLoadEnergyKwh(series, loadId)
  }
  return Number(total.toFixed(2))
}

export function coverageOfSeries(series: DemoHourlySample[]): {
  expected: number
  valid: number
  coveragePct: number
} {
  const expected = series.length
  let valid = 0
  for (const row of series) {
    if (ALL_LOAD_IDS.some((id) => row[id] !== null)) valid += 1
  }
  return {
    expected,
    valid,
    coveragePct: Number(((valid / Math.max(1, expected)) * 100).toFixed(1)),
  }
}

/** Latest non-null sample at or before asOf for a load. */
export function latestLoadPowerKw(
  series: DemoHourlySample[],
  loadId: LoadId,
  asOfIso: string = DEMO_ANCHOR,
): { powerKw: number | null; asOf: string | null } {
  const asOf = parseIstWall(asOfIso).getTime()
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const row = series[i]
    if (!row) continue
    if (parseIstWall(row.timestamp).getTime() > asOf) continue
    const v = row[loadId]
    if (v !== null && v !== undefined) {
      return { powerKw: v, asOf: row.timestamp }
    }
  }
  return { powerKw: null, asOf: null }
}

export function sitePowerAtSample(
  row: DemoHourlySample,
  loads: LoadId[],
): number | null {
  let sum = 0
  let any = false
  for (const id of loads) {
    const v = row[id]
    if (v !== null && v !== undefined) {
      sum += v
      any = true
    }
  }
  return any ? Number(sum.toFixed(2)) : null
}

/** Last N hours ending at DEMO_ANCHOR for Overview chart. */
export function overviewPowerSeries(
  hours = 24,
  asOfIso: string = DEMO_ANCHOR,
): DemoHourlySample[] {
  const series = getCanonicalDemoSeries()
  const end = parseIstWall(asOfIso).getTime()
  const inWindow = series.filter((row) => parseIstWall(row.timestamp).getTime() <= end)
  return inWindow.slice(Math.max(0, inWindow.length - hours))
}

export { BASE_KW }
