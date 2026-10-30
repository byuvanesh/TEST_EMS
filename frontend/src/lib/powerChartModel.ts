/**
 * Overview power-chart data helpers.
 *
 * Recharts stacked Area charts do not represent mixed per-load nulls honestly:
 * a missing load is often omitted from the stack/tooltip or visually collapsed
 * toward zero. Multi-series lines keep each load independent so a null gaps
 * only that series.
 */

import { LOAD_DEFINITIONS } from '@/config/loads'
import { formatChartMeasurement, type ChartUnit } from '@/lib/chartFormat'
import type { LoadId, PowerSeriesPoint } from '@/types'

export const POWER_CHART_LOAD_IDS: LoadId[] = LOAD_DEFINITIONS.map((l) => l.id)

/** Deterministic mixed-null fixture for Overview chart edge-case tests. */
export const MIXED_NULL_POWER_FIXTURE: PowerSeriesPoint[] = [
  {
    timestamp: '2026-10-30T09:00:00+05:30',
    hourLabel: '09:00',
    'AC-01': 11.5,
    'AC-02': 2.8,
    'AC-03': 17.2,
    'Compressor-01': 7.9,
  },
  {
    timestamp: '2026-10-30T10:00:00+05:30',
    hourLabel: '10:00',
    'AC-01': 12,
    'AC-02': null,
    'AC-03': 18,
    'Compressor-01': 8,
  },
  {
    timestamp: '2026-10-30T11:00:00+05:30',
    hourLabel: '11:00',
    'AC-01': 12.2,
    'AC-02': 2.9,
    'AC-03': 18.1,
    'Compressor-01': 8.1,
  },
]

export const ALL_NULL_POWER_POINT: PowerSeriesPoint = {
  timestamp: '2026-10-30T03:00:00+05:30',
  hourLabel: '03:00',
  'AC-01': null,
  'AC-02': null,
  'AC-03': null,
  'Compressor-01': null,
}

export const ACTUAL_ZERO_POWER_POINT: PowerSeriesPoint = {
  timestamp: '2026-10-30T04:00:00+05:30',
  hourLabel: '04:00',
  'AC-01': 0,
  'AC-02': 0,
  'AC-03': 0,
  'Compressor-01': 0,
}

export interface PowerTooltipRow {
  loadId: LoadId
  name: string
  color: string
  raw: number | null
  display: string
}

/** Build tooltip rows from the raw sample — never invent zeros for nulls. */
export function buildPowerTooltipRows(
  row: Partial<Record<LoadId, number | null>> | null | undefined,
  unit: ChartUnit = 'kW',
): PowerTooltipRow[] {
  return LOAD_DEFINITIONS.map((load) => {
    const raw = row?.[load.id]
    const value =
      raw === null || raw === undefined || Number.isNaN(raw) ? null : raw
    return {
      loadId: load.id,
      name: load.id,
      color: load.chartColor,
      raw: value,
      display: formatChartMeasurement(value, unit),
    }
  })
}

export function pointHasPartialMissing(point: PowerSeriesPoint): boolean {
  const values = POWER_CHART_LOAD_IDS.map((id) => point[id])
  const anyNull = values.some((v) => v === null || v === undefined)
  const anyPresent = values.some(
    (v) => v !== null && v !== undefined && !Number.isNaN(v),
  )
  return anyNull && anyPresent
}

export function seriesHasPartialMissing(series: PowerSeriesPoint[]): boolean {
  return series.some(pointHasPartialMissing)
}
