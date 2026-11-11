/**
 * Overview power chart.
 *
 * Trade-off (UI-2 edge-case): Recharts stacked `Area` cannot communicate
 * mixed per-load nulls honestly — a missing load tends to collapse toward
 * zero contribution or disappear from the stack/tooltip. This chart therefore
 * uses independent linear lines (`connectNulls={false}`) so only the missing
 * load gaps; valid loads stay readable.
 */

import {
  CartesianGrid,
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

interface StackedPowerChartProps {
  data: PowerSeriesPoint[]
  /** Optional override for window caption under the plot. */
  windowLabel?: string
}

export function StackedPowerChart({ data, windowLabel }: StackedPowerChartProps) {
  const rangeLabel = windowLabel ?? formatPowerSeriesWindowLabel(data)

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] sm:h-[300px] w-full items-center justify-center rounded-[8px] border border-dashed border-border/80 bg-surface/30 text-xs text-text-secondary">
        No power samples available in this period.
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Refined, uncluttered context header */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-text-secondary">
        <div className="flex items-center gap-1.5">
          <span className="text-text-secondary/80">Window:</span>
          <span className="font-medium text-text">{rangeLabel}</span>
        </div>
        <div className="flex items-center gap-1.5 text-text-secondary/80">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-secondary/40" />
          <span>Missing samples gap honestly</span>
        </div>
      </div>

      {/* Plot container */}
      <div className="h-[250px] sm:h-[300px] w-full min-w-0">
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
                activeDot={{ r: 4, strokeWidth: 1.5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* High-craft, responsive load legend */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-border/40 pt-2.5 text-xs text-text-secondary">
        {LOAD_DEFINITIONS.map((load) => (
          <div key={load.id} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: load.chartColor }}
              aria-hidden
            />
            <span className="font-medium text-text">{load.id}</span>
            <span className="text-[10px] text-text-secondary/70">
              ({load.capacityLabel})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
