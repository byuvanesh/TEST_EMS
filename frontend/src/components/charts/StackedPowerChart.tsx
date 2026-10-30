/**
 * Overview power chart.
 *
 * Trade-off (UI-2 edge-case): Recharts stacked `Area` cannot communicate
 * mixed per-load nulls honestly — a missing load tends to collapse toward
 * zero contribution or disappear from the stack/tooltip. This chart therefore
 * uses independent linear lines (`connectNulls={false}`) so only the missing
 * load gaps; valid loads stay readable. Site total composition is no longer
 * a filled stack; the caption states that explicitly.
 */

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PowerSeriesPoint } from '@/types'
import { LOAD_DEFINITIONS } from '@/config/loads'
import {
  CHART_GRID_STROKE,
  CHART_TICK_FILL,
  formatPowerSeriesWindowLabel,
} from '@/lib/chartFormat'
import { SeriesTooltip } from '@/components/charts/chartTooltips'
import {
  CHART_PLOT_MARGIN,
  CHART_Y_AXIS_WIDTH,
  UnitYAxisTick,
} from '@/components/charts/UnitYAxisTick'
import { seriesHasPartialMissing } from '@/lib/powerChartModel'

interface StackedPowerChartProps {
  data: PowerSeriesPoint[]
  /** Optional override for window caption under the plot. */
  windowLabel?: string
}

export function StackedPowerChart({ data, windowLabel }: StackedPowerChartProps) {
  const rangeLabel = windowLabel ?? formatPowerSeriesWindowLabel(data)
  const partialMissing = seriesHasPartialMissing(data)

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] w-full items-center justify-center rounded-[8px] border border-dashed border-border bg-surface text-xs text-text-secondary">
        No power samples in this DEMO window.
      </div>
    )
  }

  return (
    <div className="w-full">
      <p className="mb-2 text-[11px] text-text-secondary">
        Window: <span className="font-medium text-text">{rangeLabel}</span>
        {' · '}
        Unit: <span className="font-medium text-text">kW</span>
        {' · '}
        Per-load lines (not stacked)
        {' · '}
        Gaps = missing (not zero)
        {partialMissing ? (
          <>
            {' · '}
            <span className="font-medium text-text">
              Partial missing samples gap only that load
            </span>
          </>
        ) : null}
      </p>
      <div className="h-[280px] w-full min-h-[240px] sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={CHART_PLOT_MARGIN}>
            <CartesianGrid
              stroke={CHART_GRID_STROKE}
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="hourLabel"
              tick={{ fill: CHART_TICK_FILL, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: CHART_GRID_STROKE }}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tick={(props) => <UnitYAxisTick {...props} unit="kW" />}
              tickLine={false}
              axisLine={false}
              width={CHART_Y_AXIS_WIDTH}
            />
            <Tooltip
              content={
                <SeriesTooltip
                  unit="kW"
                  title="Power by load"
                  alwaysShowLoadIds
                />
              }
              isAnimationActive={false}
            />
            <Legend
              wrapperStyle={{
                fontSize: 12,
                color: CHART_TICK_FILL,
                paddingTop: 8,
              }}
            />
            {LOAD_DEFINITIONS.map((load) => (
              <Line
                key={load.id}
                type="linear"
                dataKey={load.id}
                name={load.id}
                stroke={load.chartColor}
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
