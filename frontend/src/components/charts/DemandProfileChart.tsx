import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DemandBucket } from '@/types'
import { CHART_GRID_STROKE, CHART_TICK_FILL } from '@/lib/chartFormat'
import { SingleValueTooltip } from '@/components/charts/chartTooltips'
import {
  CHART_PLOT_MARGIN,
  CHART_Y_AXIS_WIDTH,
  UnitYAxisTick,
} from '@/components/charts/UnitYAxisTick'

interface DemandProfileChartProps {
  data: DemandBucket[]
  /** Hourly site power vs daily average of valid hours. */
  aggregation?: 'hourly' | 'daily'
  seriesName?: string
}

export function DemandProfileChart({
  data,
  aggregation = 'hourly',
  seriesName,
}: DemandProfileChartProps) {
  const name =
    seriesName ??
    (aggregation === 'daily' ? 'Average power' : 'Site power')

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] w-full items-center justify-center rounded-[8px] border border-dashed border-border bg-surface text-xs text-text-secondary">
        No power samples in this DEMO period.
      </div>
    )
  }

  return (
    <div className="w-full">
      <p className="mb-2 text-[11px] text-text-secondary">
        Unit: <span className="font-medium text-text">kW</span>
        {' · '}
        Series: <span className="font-medium text-text">{name}</span>
        {' · '}
        Not a billing demand interval
        {' · '}
        Gaps = missing
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
              dataKey="label"
              tick={{ fill: CHART_TICK_FILL, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: CHART_GRID_STROKE }}
              minTickGap={24}
            />
            <YAxis
              tick={(props) => <UnitYAxisTick {...props} unit="kW" />}
              tickLine={false}
              axisLine={false}
              width={CHART_Y_AXIS_WIDTH}
            />
            <Tooltip
              content={
                <SingleValueTooltip unit="kW" seriesName={name} />
              }
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="powerKw"
              name={name}
              stroke="#2563EB"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
