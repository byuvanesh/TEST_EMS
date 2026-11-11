import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { EnergyBucket, LoadId } from '@/types'
import { LOAD_DEFINITIONS } from '@/config/loads'
import { CHART_GRID_STROKE, CHART_TICK_FILL } from '@/lib/chartFormat'
import { SeriesTooltip } from '@/components/charts/chartTooltips'
import {
  CHART_PLOT_MARGIN,
  CHART_Y_AXIS_WIDTH,
  UnitYAxisTick,
} from '@/components/charts/UnitYAxisTick'

interface EnergyByLoadChartProps {
  data: EnergyBucket[]
  loads: LoadId[]
  aggregation?: 'hourly' | 'daily'
}

export function EnergyByLoadChart({
  data,
  loads,
  aggregation = 'hourly',
}: EnergyByLoadChartProps) {
  const series = LOAD_DEFINITIONS.filter((l) => loads.includes(l.id))

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] w-full items-center justify-center rounded-[8px] border border-dashed border-border bg-surface text-xs text-text-secondary">
        No energy samples in this period.
      </div>
    )
  }

  return (
    <div className="w-full">
      <p className="mb-2 text-[11px] text-text-secondary">
        Unit: <span className="font-medium text-text">kWh</span>
        {' · '}
        Bucket: <span className="font-medium text-text">{aggregation}</span>
        {' · '}
        Missing hours excluded from totals (not drawn as 0)
      </p>
      <div className="h-[280px] w-full min-h-[240px] sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={CHART_PLOT_MARGIN}>
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
              tick={(props) => <UnitYAxisTick {...props} unit="kWh" />}
              tickLine={false}
              axisLine={false}
              width={CHART_Y_AXIS_WIDTH}
            />
            <Tooltip
              content={<SeriesTooltip unit="kWh" title="Energy by load" />}
              isAnimationActive={false}
            />
            <Legend
              wrapperStyle={{
                fontSize: 12,
                color: CHART_TICK_FILL,
                paddingTop: 8,
              }}
            />
            {series.map((load) => (
              <Bar
                key={load.id}
                dataKey={load.id}
                name={load.id}
                stackId="energy"
                fill={load.chartColor}
                isAnimationActive={false}
                maxBarSize={48}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
