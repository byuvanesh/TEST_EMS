/**
 * Chart display helpers — distinguish null (missing) from numeric zero.
 * Pure functions; safe to unit-test without Recharts DOM.
 */

import type { CSSProperties } from 'react'
import { parseIstWall } from '@/lib/period'
import type { LoadId, PowerSeriesPoint } from '@/types'
import { LOAD_DEFINITIONS } from '@/config/loads'

export type ChartUnit = 'kW' | 'kWh'

/** Format a chart numeric or missing value for tooltips / legends. */
export function formatChartMeasurement(
  value: number | null | undefined,
  unit: ChartUnit,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'No data'
  }
  return `${value.toLocaleString('en-IN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} ${unit}`
}

/** True when the value is a reported zero (not missing). */
export function isReportedZero(value: number | null | undefined): boolean {
  return value === 0
}

/** True when the sample is missing. */
export function isMissingMeasurement(value: number | null | undefined): boolean {
  return value === null || value === undefined || Number.isNaN(value)
}

/** Non-breaking space for string-form axis labels (tooltips / tests). */
export const AXIS_UNIT_SEP = '\u00A0'

/**
 * String form of a one-line axis tick (uses NBSP).
 * Charts render via UnitYAxisTick (dual tspan) for reliable layout.
 */
export function formatAxisTickWithUnit(
  value: number,
  unit: ChartUnit,
): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return `—${AXIS_UNIT_SEP}${unit}`
  const digits = Math.abs(n) >= 100 ? 0 : 1
  return `${n.toFixed(digits)}${AXIS_UNIT_SEP}${unit}`
}

export function loadChartColor(loadId: LoadId): string {
  return (
    LOAD_DEFINITIONS.find((l) => l.id === loadId)?.chartColor ?? '#64748B'
  )
}

export function formatIstChartTimestamp(iso: string): string {
  const d = parseIstWall(iso)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** Explicit Overview 24h window label from series endpoints (IST wall). */
export function formatPowerSeriesWindowLabel(
  series: Pick<PowerSeriesPoint, 'timestamp'>[],
): string {
  if (series.length === 0) return 'No samples in window'
  const first = series[0]?.timestamp
  const last = series[series.length - 1]?.timestamp
  if (!first || !last) return 'No samples in window'
  return `${formatIstChartTimestamp(first)} – ${formatIstChartTimestamp(last)}`
}

export const CHART_GRID_STROKE = '#E5EAF1'
export const CHART_TICK_FILL = '#64748B'
export const CHART_TOOLTIP_STYLE: CSSProperties = {
  borderRadius: 8,
  border: '1px solid #E5EAF1',
  boxShadow: '0 4px 16px rgba(23, 32, 51, 0.08)',
  fontSize: 12,
  background: '#FFFFFF',
  color: '#172033',
  padding: '8px 10px',
}
