import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { EnergyByLoadChart } from '@/components/charts/EnergyByLoadChart'
import { DemandProfileChart } from '@/components/charts/DemandProfileChart'
import { Card, CardHeader } from '@/components/ui/Card'
import { DeltaBadge } from '@/components/ui/DeltaBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SelectField } from '@/components/ui/SelectField'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  buildEnergyAnalytics,
  buildEnergyCsv,
  downloadTextFile,
  percentDelta,
} from '@/lib/energyAnalytics'
import { formatNumber } from '@/lib/format'
import { LOAD_DEFINITIONS } from '@/config/loads'
import type { EnergyPeriodPreset, LoadFilter } from '@/types'

const PERIOD_OPTIONS: { value: EnergyPeriodPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
]

const LOAD_OPTIONS: { value: LoadFilter; label: string }[] = [
  { value: 'all', label: 'All Loads' },
  ...LOAD_DEFINITIONS.map((l) => ({ value: l.id, label: l.name })),
]

export function EnergyPage() {
  const [period, setPeriod] = useState<EnergyPeriodPreset>('today')
  const [loadFilter, setLoadFilter] = useState<LoadFilter>('all')
  const [customStart, setCustomStart] = useState('2026-10-20')
  const [customEnd, setCustomEnd] = useState('2026-10-30')

  const analytics = useMemo(
    () =>
      buildEnergyAnalytics({
        period: { preset: period, customStart, customEnd },
        loadFilter,
      }),
    [period, loadFilter, customStart, customEnd],
  )

  const handleExport = () => {
    if (analytics.unavailableReason) return
    const csv = buildEnergyCsv(analytics)
    const safePeriod = analytics.period.preset
    downloadTextFile(
      `test-ems-energy-demo-${safePeriod}-${loadFilter}.csv`,
      csv,
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Energy"
        description="Period analytics from deterministic DEMO DATA. Tariff / billing cost not calculated."
        actions={<StatusBadge state="DEMO" />}
      />

      <DataStateBanner
        state="DEMO"
        message="Energy figures are fabricated DEMO DATA (hourly kW × 1 h ≈ kWh). They are not meter counter deltas. Demand interval and tariff remain unconfirmed."
      />

      {analytics.partialPeriod && analytics.partialPeriodMessage ? (
        <DataStateBanner
          state="DEMO"
          message={analytics.partialPeriodMessage}
        />
      ) : null}

      {analytics.coverageCompareNote ? (
        <DataStateBanner state="DEMO" message={analytics.coverageCompareNote} />
      ) : null}

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <SelectField
              id="energy-period"
              label="Period"
              value={period}
              options={PERIOD_OPTIONS}
              onChange={(v) => setPeriod(v as EnergyPeriodPreset)}
            />
            <SelectField
              id="energy-load"
              label="Load"
              value={loadFilter}
              options={LOAD_OPTIONS}
              onChange={(v) => setLoadFilter(v as LoadFilter)}
            />
            {period === 'custom' ? (
              <>
                <label className="flex min-w-[140px] flex-col gap-1">
                  <span className="text-[11px] font-medium text-text-secondary">
                    Start date
                  </span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-9 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
                  />
                </label>
                <label className="flex min-w-[140px] flex-col gap-1">
                  <span className="text-[11px] font-medium text-text-secondary">
                    End date
                  </span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-9 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
                  />
                </label>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={Boolean(analytics.unavailableReason)}
            className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-border bg-card px-3 text-xs font-medium text-text hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-text-secondary">
          <span>
            Period:{' '}
            <strong className="font-medium text-text">
              {analytics.period.label || '—'}
            </strong>
          </span>
          <span>
            Units: <strong className="font-medium text-text">kWh / kW</strong>
          </span>
          <span>
            Coverage:{' '}
            <strong className="tabular font-medium text-text">
              {formatNumber(analytics.coveragePct, 1)}%
            </strong>{' '}
            ({analytics.validSamples}/{analytics.expectedSamples} samples)
          </span>
          <StatusBadge state="DEMO" compact />
        </div>
      </Card>

      {analytics.unavailableReason ? (
        <EmptyState
          title="Period unavailable"
          description={analytics.unavailableReason}
        />
      ) : (
        <>
          <section
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Energy KPIs"
          >
            <Kpi
              label="Energy consumption"
              value={`${formatNumber(analytics.energyKwh, 1)} kWh`}
              delta={analytics.energyDeltaPct}
              note={`vs previous · ${analytics.previousPeriod.label}`}
            />
            <Kpi
              label="Peak power"
              value={`${formatNumber(analytics.peakPowerKw, 1)} kW`}
              delta={percentDelta(
                analytics.peakPowerKw,
                analytics.previousPeakPowerKw,
              )}
              note={analytics.demandIntervalNote}
            />
            <Kpi
              label="Average power"
              value={`${formatNumber(analytics.averagePowerKw, 1)} kW`}
              delta={percentDelta(
                analytics.averagePowerKw,
                analytics.previousAveragePowerKw,
              )}
              note="Mean of valid demo samples in period (null gaps excluded)"
            />
            <Kpi
              label="Load contribution"
              value={
                analytics.loadRows.length === 1
                  ? `${formatNumber(analytics.loadRows[0]?.contributionPct, 1)}%`
                  : 'See table'
              }
              note={
                analytics.loadFilter === 'all'
                  ? 'Per-load % in comparison table'
                  : `${analytics.includedLoads[0]} share of filtered total`
              }
            />
          </section>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Card>
              <CardHeader
                title="Energy consumption by load"
                subtitle={`DEMO DATA · stacked kWh · ${analytics.chartAggregation} buckets · coverage ${formatNumber(analytics.coveragePct, 1)}%`}
                action={<StatusBadge state="DEMO" compact />}
              />
              <EnergyByLoadChart
                data={analytics.energySeries}
                loads={analytics.includedLoads}
                aggregation={analytics.chartAggregation}
              />
            </Card>
            <Card>
              <CardHeader
                title={
                  analytics.chartAggregation === 'daily'
                    ? 'Average power by day'
                    : 'Site power profile'
                }
                subtitle={
                  analytics.chartAggregation === 'daily'
                    ? 'DEMO DATA · daily mean of valid hourly kW · not billing demand'
                    : 'DEMO DATA · hourly site kW · not a verified demand interval'
                }
                action={<StatusBadge state="DEMO" compact />}
              />
              <DemandProfileChart
                data={analytics.demandSeries}
                aggregation={analytics.chartAggregation}
              />
              <p className="mt-2 text-[11px] text-text-secondary">
                {analytics.demandIntervalNote}
              </p>
            </Card>
          </section>

          <Card padding="none">
            <div className="border-b border-border px-5 py-4">
              <CardHeader
                className="mb-0"
                title="Load comparison"
                subtitle="Previous-period energy delta · DEMO DATA · no cost column (tariff TBD)"
                action={<StatusBadge state="DEMO" compact />}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-surface text-xs text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-medium">Load</th>
                    <th className="px-4 py-3 font-medium">Energy (kWh)</th>
                    <th className="px-4 py-3 font-medium">Peak (kW)</th>
                    <th className="px-4 py-3 font-medium">Avg (kW)</th>
                    <th className="px-4 py-3 font-medium">Contribution</th>
                    <th className="px-4 py-3 font-medium">Prev energy</th>
                    <th className="px-4 py-3 font-medium">Δ vs prev</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.loadRows.map((row) => {
                    const def = LOAD_DEFINITIONS.find((l) => l.id === row.loadId)
                    return (
                      <tr key={row.loadId} className="border-t border-border">
                        <td className="px-4 py-3">
                          <Link
                            to={`/loads/${row.loadId}`}
                            className="inline-flex items-center gap-2 font-medium text-accent hover:underline"
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: def?.chartColor }}
                            />
                            {row.loadId}
                          </Link>
                          <p className="text-[11px] text-text-secondary">
                            {def?.capacityLabel}
                          </p>
                        </td>
                        <td className="tabular px-4 py-3">
                          {formatNumber(row.energyKwh, 1)}
                        </td>
                        <td className="tabular px-4 py-3">
                          {formatNumber(row.peakPowerKw, 1)}
                        </td>
                        <td className="tabular px-4 py-3">
                          {formatNumber(row.averagePowerKw, 1)}
                        </td>
                        <td className="tabular px-4 py-3">
                          {formatNumber(row.contributionPct, 1)}%
                        </td>
                        <td className="tabular px-4 py-3 text-text-secondary">
                          {formatNumber(row.previousEnergyKwh, 1)}
                        </td>
                        <td className="px-4 py-3">
                          <DeltaBadge value={row.energyDeltaPct} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function Kpi({
  label,
  value,
  delta,
  note,
}: {
  label: string
  value: string
  delta?: number | null
  note?: string
}) {
  return (
    <Card className="flex min-h-[120px] flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        <StatusBadge state="DEMO" compact />
      </div>
      <div className="mt-3">
        <p className="tabular text-[28px] font-semibold leading-none tracking-tight text-text">
          {value}
        </p>
        {delta !== undefined ? (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-text-secondary">
            Prev period <DeltaBadge value={delta ?? null} />
          </p>
        ) : null}
        {note ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-secondary">
            {note}
          </p>
        ) : null}
      </div>
    </Card>
  )
}
