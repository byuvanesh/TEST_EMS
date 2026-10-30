/**
 * Custom Y-axis tick that keeps value + unit on one visual line.
 *
 * Root cause of prior wrapping: Recharts' default tick path splits formatted
 * strings on ASCII spaces when the Y-axis band is narrow (`width` ~56px),
 * rendering "20.0" and "kW" as separate lines.
 *
 * Fix: custom tick with two same-baseline <tspan>s (no space character),
 * wider axis band, and shared plot margins.
 */

import {
  CHART_TICK_FILL,
  type ChartUnit,
} from '@/lib/chartFormat'

interface UnitYAxisTickProps {
  x?: number | string
  y?: number | string
  payload?: { value?: number | string }
  unit: ChartUnit
}

export function formatAxisTickParts(
  value: number,
  unit: ChartUnit,
): { valueText: string; unitText: ChartUnit } {
  const n = Number(value)
  if (!Number.isFinite(n)) return { valueText: '—', unitText: unit }
  const digits = Math.abs(n) >= 100 ? 0 : 1
  return { valueText: n.toFixed(digits), unitText: unit }
}

export function UnitYAxisTick(props: UnitYAxisTickProps) {
  const { unit, payload } = props
  const x = Number(props.x ?? 0)
  const y = Number(props.y ?? 0)
  const { valueText, unitText } = formatAxisTickParts(Number(payload?.value), unit)

  return (
    <text
      x={x}
      y={y}
      textAnchor="end"
      dominantBaseline="middle"
      fill={CHART_TICK_FILL}
      fontSize={11}
    >
      <tspan>{valueText}</tspan>
      <tspan dx={3}>{unitText}</tspan>
    </text>
  )
}

/** Wide enough for "20.0" + gap + "kWh" without clipping. */
export const CHART_Y_AXIS_WIDTH = 84
export const CHART_PLOT_MARGIN = { top: 8, right: 12, left: 12, bottom: 4 } as const
