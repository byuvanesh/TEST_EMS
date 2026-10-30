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
}

export function LoadCard({ reading }: LoadCardProps) {
  const def = getLoadDefinition(reading.loadId)

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: def?.chartColor ?? '#64748B' }}
            aria-hidden
          />
          <div>
            <h3 className="text-sm font-semibold text-text">{reading.loadId}</h3>
            <p className="text-[11px] text-text-secondary">
              {def?.capacityLabel ?? '—'}
            </p>
          </div>
        </div>
        <StatusBadge state={reading.dataState} compact />
      </div>

      <p className="tabular mt-4 text-[28px] font-semibold leading-none text-text">
        {formatNumber(reading.activePowerKw, 1)}
        <span className="ml-1.5 text-sm font-medium text-text-secondary">kW</span>
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Metric label="Current" value={`${formatNumber(reading.currentA, 1)} A`} />
        <Metric label="Voltage" value={`${formatNumber(reading.voltageV, 0)} V`} />
        <Metric label="PF" value={formatPowerFactor(reading.powerFactor)} />
        <Metric
          label="Energy today"
          value={`${formatNumber(reading.energyTodayKwh, 1)} kWh`}
        />
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <FreshnessIndicator asOf={reading.asOf} />
        <Link
          to={`/loads/${reading.loadId}`}
          className="inline-flex items-center gap-0.5 text-xs font-medium text-accent hover:underline"
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
    <div>
      <dt className="text-text-secondary">{label}</dt>
      <dd className="tabular mt-0.5 font-medium text-text">{value}</dd>
    </div>
  )
}
