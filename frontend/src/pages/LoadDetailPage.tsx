import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useAlarmStore } from '@/context/AlarmStore'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { buildOverviewData } from '@/mock/demoData'
import { getLoadDefinition, LOAD_DEFINITIONS } from '@/config/loads'
import { formatNumber, formatPowerFactor } from '@/lib/format'

const LOAD_IDS = LOAD_DEFINITIONS.map((l) => l.id)

export function LoadDetailPage() {
  const { loadId } = useParams<{ loadId: string }>()
  const { openAlarms } = useAlarmStore()
  const def = loadId ? getLoadDefinition(loadId) : undefined
  const reading = buildOverviewData(openAlarms).loads.find(
    (l) => l.loadId === loadId,
  )

  if (!def || !reading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Load not found" />
        <EmptyState
          title="Unknown load"
          description="Use Overview load cards or a valid load id (AC-01, AC-02, AC-03, Compressor-01)."
        />
        <Link to="/" className="text-sm font-medium text-accent hover:underline">
          Back to Overview
        </Link>
      </div>
    )
  }

  const index = LOAD_IDS.indexOf(def.id)
  const prev = index > 0 ? LOAD_IDS[index - 1] : null
  const next = index < LOAD_IDS.length - 1 ? LOAD_IDS[index + 1] : null

  return (
    <div className="space-y-5">
      <PageHeader
        title={def.name}
        description={`${def.capacityLabel} · Electrical monitoring only`}
        breadcrumbs={
          <nav className="flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
            <Link to="/" className="hover:text-accent">
              Overview
            </Link>
            <span>/</span>
            <span className="text-text">{def.name}</span>
          </nav>
        }
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge state={reading.dataState} />
            <div className="flex gap-1">
              {prev ? (
                <Link
                  to={`/loads/${prev}`}
                  className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {prev}
                </Link>
              ) : null}
              {next ? (
                <Link
                  to={`/loads/${next}`}
                  className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface"
                >
                  {next}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </div>
        }
      />

      <DataStateBanner
        state={reading.dataState}
        message="DEMO readings from the shared canonical series. Energy today matches Overview and Energy page for this load."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active power"
          value={`${formatNumber(reading.activePowerKw, 1)} kW`}
          asOf={reading.asOf}
        />
        <MetricCard
          label="Current"
          value={`${formatNumber(reading.currentA, 1)} A`}
          asOf={reading.asOf}
        />
        <MetricCard
          label="Voltage"
          value={`${formatNumber(reading.voltageV, 0)} V`}
          asOf={reading.asOf}
        />
        <MetricCard
          label="Power factor"
          value={formatPowerFactor(reading.powerFactor)}
          asOf={reading.asOf}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Additional electrical"
            subtitle="Frequency and energy today (demo · shared series)"
          />
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-text-secondary">Frequency</dt>
              <dd className="tabular mt-1 font-semibold text-text">
                {formatNumber(reading.frequencyHz, 1)} Hz
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">Energy today</dt>
              <dd className="tabular mt-1 font-semibold text-text">
                {formatNumber(reading.energyTodayKwh, 1)} kWh
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <EmptyState
            title="Advanced parameters"
            description="Per-phase values, THD, and unbalance render only when a future API reports them as available. Meter capability is VERIFY — not assumed for this load."
          />
        </Card>
      </div>

      {def.id === 'Compressor-01' ? (
        <Card>
          <p className="text-xs leading-relaxed text-text-secondary">
            Compressor type and capacity remain TBD. Temperature, pressure, and
            loaded/unloaded status sensors are out of scope. Only electrical
            readings are shown.
          </p>
        </Card>
      ) : null}
    </div>
  )
}

function MetricCard({
  label,
  value,
  asOf,
}: {
  label: string
  value: string
  asOf: string
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        <StatusBadge state="DEMO" compact />
      </div>
      <p className="tabular mt-3 text-[28px] font-semibold leading-none text-text">
        {value}
      </p>
      <FreshnessIndicator asOf={asOf} className="mt-3" />
    </Card>
  )
}
