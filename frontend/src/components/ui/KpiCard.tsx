import type { KpiSnapshot } from '@/types'
import { formatNumber, formatPowerFactor } from '@/lib/format'
import { Card } from './Card'
import { FreshnessIndicator } from './FreshnessIndicator'
import { StatusBadge } from './StatusBadge'

interface KpiCardProps {
  kpi: KpiSnapshot
}

export function KpiCard({ kpi }: KpiCardProps) {
  const display =
    kpi.id === 'aggregate-pf'
      ? formatPowerFactor(kpi.value)
      : kpi.id === 'active-alarms'
        ? formatNumber(kpi.value, 0)
        : formatNumber(kpi.value, 1)

  return (
    <Card className="flex min-h-[120px] flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-text-secondary">{kpi.label}</p>
        <StatusBadge state={kpi.dataState} compact />
      </div>
      <div className="mt-3">
        <p className="tabular text-[28px] font-semibold leading-none tracking-tight text-text">
          {display}
          {kpi.unit ? (
            <span className="ml-1.5 text-sm font-medium text-text-secondary">
              {kpi.unit}
            </span>
          ) : null}
        </p>
        {kpi.note ? (
          <p className="mt-1.5 text-[11px] text-text-secondary">{kpi.note}</p>
        ) : null}
      </div>
      <FreshnessIndicator asOf={kpi.asOf} className="mt-3" />
    </Card>
  )
}
