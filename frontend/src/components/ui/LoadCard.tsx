import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { LoadElectricalReading } from '@/types'
import { getLoadDefinition } from '@/config/loads'
import { formatNumber, formatPowerFactor } from '@/lib/format'
import { Card } from './Card'
import { FreshnessIndicator } from './FreshnessIndicator'
import { StatusBadge } from './StatusBadge'

interface LoadCardProps {
  reading: LoadElectricalReading
  showBadge?: boolean
}

export function LoadCard({ reading, showBadge = false }: LoadCardProps) {
  const def = getLoadDefinition(reading.loadId)
  const color = def?.chartColor ?? '#64748B'

  const kwDisplay =
    reading.activePowerKw !== null
      ? formatNumber(reading.activePowerKw, 1)
      : '—'

  const currentDisplay =
    reading.currentA !== null
      ? `${formatNumber(reading.currentA, 1)} A`
      : '—'

  const voltageDisplay =
    reading.voltageV !== null
      ? `${formatNumber(reading.voltageV, 0)} V`
      : '—'

  const pfDisplay = formatPowerFactor(reading.powerFactor)

  const energyDisplay =
    reading.energyTodayKwh !== null
      ? `${formatNumber(reading.energyTodayKwh, 1)} kWh`
      : '—'

  return (
    <Card className="group relative flex flex-col justify-between rounded-[10px] border border-border/80 bg-card p-4 shadow-2xs transition-all hover:border-border hover:shadow-xs">
      <div>
        {/* Load header with color indicator */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold tracking-tight text-text">
                {reading.loadId}
              </h3>
            </div>
            <span className="shrink-0 rounded-full border border-border/60 bg-surface/70 px-2 py-0.5 text-[10px] font-medium text-text-secondary">
              {def?.capacityLabel ?? '—'}
            </span>
          </div>
          {showBadge && <StatusBadge state={reading.dataState} compact />}
        </div>

        {/* Primary Active Power Reading */}
        <div className="mt-3">
          <p className="tabular flex items-baseline text-2xl font-bold tracking-tight text-text leading-none sm:text-[28px]">
            <span>{kwDisplay}</span>
            {reading.activePowerKw !== null ? (
              <span className="ml-1.5 text-xs font-semibold text-text-secondary">kW</span>
            ) : null}
          </p>
        </div>

        {/* Secondary electrical measurements grid */}
        <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-[8px] border border-border/50 bg-surface/40 p-2.5 text-xs">
          <Metric label="Current" value={currentDisplay} />
          <Metric label="Voltage" value={voltageDisplay} />
          <Metric label="PF" value={pfDisplay} />
          <Metric label="Energy today" value={energyDisplay} />
        </div>
      </div>

      {/* Footer with timestamp and detail button */}
      <div className="mt-3.5 flex items-center justify-between border-t border-border/60 pt-2.5">
        <FreshnessIndicator asOf={reading.asOf} className="text-[10px] text-text-secondary/70" />
        <Link
          to={`/loads/${reading.loadId}`}
          className="inline-flex min-h-[32px] items-center gap-1 rounded-[6px] px-2.5 py-1 text-xs font-medium text-accent hover:bg-surface active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Detail
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] font-medium uppercase tracking-wider text-text-secondary/80">
        {label}
      </dt>
      <dd className="tabular mt-0.5 truncate font-semibold text-text">
        {value}
      </dd>
    </div>
  )
}
