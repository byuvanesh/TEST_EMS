import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDataSource } from '@/context/DataSourceContext'
import { apiClient, type ApiEnergyResponse, type ApiCatalogueLoad } from '@/api/client'
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
  buildRealEnergyCsv,
  downloadTextFile,
  percentDelta,
} from '@/lib/energyAnalytics'
import { formatNumber, formatTimestamp } from '@/lib/format'
import { LOAD_DEFINITIONS } from '@/config/loads'
import type { DataQualityState, EnergyPeriodPreset, LoadFilter } from '@/types'

const DEMO_PERIOD_OPTIONS: { value: EnergyPeriodPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
]

export function EnergyPage() {
  const { isReal } = useDataSource()

  // Real data state
  const [realLoads, setRealLoads] = useState<ApiCatalogueLoad[]>([])
  const [realEnergy, setRealEnergy] = useState<ApiEnergyResponse | null>(null)
  const [realLoading, setRealLoading] = useState(isReal)
  const [realError, setRealError] = useState<string | null>(null)

  // Filter state
  const [period, setPeriod] = useState<EnergyPeriodPreset>('today')
  const [loadFilter, setLoadFilter] = useState<string>('all')
  const [customStart, setCustomStart] = useState('2026-10-20')
  const [customEnd, setCustomEnd] = useState('2026-10-30')

  // Fetch catalogue loads and energy when in REAL mode
  useEffect(() => {
    if (!isReal) return

    let cancelled = false

    async function fetchLoads() {
      try {
        const loadsRes = await apiClient.getLoads('REAL')
        if (!cancelled) {
          setRealLoads(loadsRes.loads)
        }
      } catch {
        // Catalogue failure
      }
    }

    fetchLoads()
    return () => {
      cancelled = true
    }
  }, [isReal])

  useEffect(() => {
    if (!isReal) return

    let cancelled = false

    async function fetchEnergyTelemetry() {
      try {
        const energyRes = await apiClient.getEnergy(
          loadFilter === 'all' ? undefined : loadFilter,
          undefined,
          'REAL',
        )
        if (!cancelled) {
          setRealEnergy(energyRes)
          setRealError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setRealError((err as Error).message || 'Failed to fetch energy analytics.')
        }
      } finally {
        if (!cancelled) setRealLoading(false)
      }
    }

    fetchEnergyTelemetry()
    const timer = setInterval(fetchEnergyTelemetry, 8000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [isReal, loadFilter])

  // Demo analytics
  const demoAnalytics = useMemo(
    () =>
      buildEnergyAnalytics({
        period: { preset: period, customStart, customEnd },
        loadFilter: loadFilter as LoadFilter,
      }),
    [period, loadFilter, customStart, customEnd],
  )

  const loadOptions = useMemo(() => {
    if (isReal && realLoads.length > 0) {
      return [
        { value: 'all', label: 'All Loads' },
        ...realLoads.map((l) => ({ value: l.id, label: `${l.code} - ${l.name}` })),
      ]
    }
    return [
      { value: 'all', label: 'All Loads' },
      ...LOAD_DEFINITIONS.map((l) => ({ value: l.id, label: l.name })),
    ]
  }, [isReal, realLoads])

  const handleExport = () => {
    if (isReal) {
      if (!realEnergy) return
      const csv = buildRealEnergyCsv(realEnergy, loadFilter)
      downloadTextFile(
        `test-ems-energy-REAL-${loadFilter}-${new Date().toISOString().slice(0, 10)}.csv`,
        csv,
      )
    } else {
      if (demoAnalytics.unavailableReason) return
      const csv = buildEnergyCsv(demoAnalytics)
      const safePeriod = demoAnalytics.period.preset
      downloadTextFile(
        `test-ems-energy-DEMO-${safePeriod}-${loadFilter}.csv`,
        csv,
      )
    }
  }

  // --- Real mode rendering ---
  if (isReal) {
    const dataState: DataQualityState =
      (realEnergy?.data_state as DataQualityState) || 'NO_DATA'
    const isUnavailable = realEnergy?.availability === 'UNAVAILABLE'
    const hasGaps = Boolean(realEnergy?.has_gaps)

    return (
      <div className="space-y-5">
        <PageHeader
          title="Energy"
          description="Operational energy analytics via meter counter-delta (active_import_kwh). Electrical monitoring only."
          actions={<StatusBadge state={dataState} />}
        />

        {realError ? (
          <DataStateBanner
            state="OFFLINE"
            message={`Error loading energy telemetry: ${realError}`}
          />
        ) : isUnavailable ? (
          <DataStateBanner
            state="NO_DATA"
            message="Operational energy counter is unverified in Phase 2b. Energy metrics and demand intervals are not estimated or smoothed."
          />
        ) : hasGaps ? (
          <div
            className="flex items-start gap-2 rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900 leading-relaxed dark:text-amber-200"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              <strong>Counter GAP detected:</strong> One or more intervals contain counter rollover, reset, or missing samples. Gaps are excluded from consumption totals and never treated as zero.
            </p>
          </div>
        ) : (
          <DataStateBanner
            state={dataState}
            message="Operational energy telemetry active. Readings computed via verified meter counter deltas."
          />
        )}

        {/* Filter Bar */}
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-3">
              <SelectField
                id="energy-load"
                label="Load"
                value={loadFilter}
                options={loadOptions}
                onChange={(v) => setLoadFilter(v)}
              />
            </div>

            <button
              type="button"
              onClick={handleExport}
              disabled={!realEnergy || realLoading}
              className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-border bg-card px-3 text-xs font-medium text-text hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export REAL CSV
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-text-secondary">
            <span>
              Source:{' '}
              <strong className="font-medium text-text">
                REAL (telemetry_samples)
              </strong>
            </span>
            <span>
              Method:{' '}
              <strong className="font-medium text-text">
                {realEnergy?.method ?? 'counter-delta'}
              </strong>
            </span>
            <span>
              Gaps status:{' '}
              <strong
                className={
                  hasGaps
                    ? 'font-semibold text-amber-600'
                    : 'font-medium text-text'
                }
              >
                {hasGaps ? 'GAP intervals present' : 'No gaps'}
              </strong>
            </span>
            <StatusBadge state={dataState} compact />
          </div>
        </Card>

        {/* Real KPIs */}
        <section
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Energy KPIs"
        >
          <KpiCard
            label="Total energy consumption"
            value={
              isUnavailable
                ? '—'
                : `${formatNumber(realEnergy?.total_energy_kwh, 2)} kWh`
            }
            note={
              isUnavailable
                ? 'Counter unverified in Phase 2b'
                : hasGaps
                  ? 'Gaps excluded from total'
                  : 'Verified counter delta'
            }
            dataState={dataState}
          />
          <KpiCard
            label="Peak demand"
            value="—"
            note="Demand interval TBD — no assumed billing window"
            dataState="NO_DATA"
          />
          <KpiCard
            label="Average power"
            value="—"
            note="No verified demand interval in Phase 2b"
            dataState="NO_DATA"
          />
          <KpiCard
            label="Intervals recorded"
            value={
              realEnergy?.intervals
                ? `${realEnergy.intervals.length} intervals`
                : '—'
            }
            note={
              hasGaps
                ? 'Rollover / reset flagged as GAP'
                : 'Decoded meter deltas'
            }
            dataState={dataState}
          />
        </section>

        {/* Real Interval History & GAP Breakdown */}
        <Card padding="none">
          <div className="border-b border-border px-5 py-4">
            <CardHeader
              className="mb-0"
              title="Operational Counter Intervals"
              subtitle="Intervals computed from consecutive active_import_kwh samples (negative/rollover = GAP, not zero)"
              action={<StatusBadge state={dataState} compact />}
            />
          </div>

          {realLoading && !realEnergy ? (
            <div className="p-6 text-center text-sm text-text-secondary">
              Loading energy intervals…
            </div>
          ) : realEnergy && realEnergy.intervals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-surface text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-medium">Start Time</th>
                    <th className="px-4 py-3 font-medium">End Time</th>
                    <th className="px-4 py-3 font-medium">Start kWh</th>
                    <th className="px-4 py-3 font-medium">End kWh</th>
                    <th className="px-4 py-3 font-medium">Energy (kWh)</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Note / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {realEnergy.intervals.map((interval, idx) => {
                    const isGap = interval.status === 'GAP'
                    return (
                      <tr
                        key={idx}
                        className={
                          isGap
                            ? 'bg-amber-500/5 hover:bg-amber-500/10'
                            : 'hover:bg-surface/50'
                        }
                      >
                        <td className="px-4 py-3 font-mono text-[11px] text-text-secondary whitespace-nowrap">
                          {formatTimestamp(interval.start_time)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-text-secondary whitespace-nowrap">
                          {formatTimestamp(interval.end_time)}
                        </td>
                        <td className="tabular px-4 py-3 text-text">
                          {interval.start_kwh !== null
                            ? formatNumber(interval.start_kwh, 2)
                            : '—'}
                        </td>
                        <td className="tabular px-4 py-3 text-text">
                          {interval.end_kwh !== null
                            ? formatNumber(interval.end_kwh, 2)
                            : '—'}
                        </td>
                        <td className="tabular px-4 py-3 font-semibold text-text">
                          {isGap
                            ? '—'
                            : interval.energy_kwh !== null
                              ? `${formatNumber(interval.energy_kwh, 2)}`
                              : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {isGap ? (
                            <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 uppercase dark:text-amber-300">
                              GAP
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success uppercase">
                              OK
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {isGap
                            ? interval.reason ?? 'Rollover or missing sample'
                            : 'Valid delta'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6">
              <EmptyState
                title="No energy intervals available"
                description={
                  isUnavailable
                    ? 'Active import counter telemetry is unverified in Phase 2b. Telemetry samples will be delta-analyzed here once live counter updates arrive.'
                    : 'No telemetry samples recorded for the selected load.'
                }
              />
            </div>
          )}
        </Card>
      </div>
    )
  }

  // --- DEMO mode rendering ---
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

      {demoAnalytics.partialPeriod && demoAnalytics.partialPeriodMessage ? (
        <DataStateBanner
          state="DEMO"
          message={demoAnalytics.partialPeriodMessage}
        />
      ) : null}

      {demoAnalytics.coverageCompareNote ? (
        <DataStateBanner state="DEMO" message={demoAnalytics.coverageCompareNote} />
      ) : null}

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <SelectField
              id="energy-period"
              label="Period"
              value={period}
              options={DEMO_PERIOD_OPTIONS}
              onChange={(v) => setPeriod(v as EnergyPeriodPreset)}
            />
            <SelectField
              id="energy-load"
              label="Load"
              value={loadFilter}
              options={loadOptions}
              onChange={(v) => setLoadFilter(v)}
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
            disabled={Boolean(demoAnalytics.unavailableReason)}
            className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-border bg-card px-3 text-xs font-medium text-text hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export DEMO CSV
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-text-secondary">
          <span>
            Period:{' '}
            <strong className="font-medium text-text">
              {demoAnalytics.period.label || '—'}
            </strong>
          </span>
          <span>
            Units: <strong className="font-medium text-text">kWh / kW</strong>
          </span>
          <span>
            Coverage:{' '}
            <strong className="tabular font-medium text-text">
              {formatNumber(demoAnalytics.coveragePct, 1)}%
            </strong>{' '}
            ({demoAnalytics.validSamples}/{demoAnalytics.expectedSamples} samples)
          </span>
          <StatusBadge state="DEMO" compact />
        </div>
      </Card>

      {demoAnalytics.unavailableReason ? (
        <EmptyState
          title="Period unavailable"
          description={demoAnalytics.unavailableReason}
        />
      ) : (
        <>
          <section
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Energy KPIs"
          >
            <KpiCard
              label="Energy consumption"
              value={`${formatNumber(demoAnalytics.energyKwh, 1)} kWh`}
              delta={demoAnalytics.energyDeltaPct}
              note={`vs previous · ${demoAnalytics.previousPeriod.label}`}
              dataState="DEMO"
            />
            <KpiCard
              label="Peak power"
              value={`${formatNumber(demoAnalytics.peakPowerKw, 1)} kW`}
              delta={percentDelta(
                demoAnalytics.peakPowerKw,
                demoAnalytics.previousPeakPowerKw,
              )}
              note={demoAnalytics.demandIntervalNote}
              dataState="DEMO"
            />
            <KpiCard
              label="Average power"
              value={`${formatNumber(demoAnalytics.averagePowerKw, 1)} kW`}
              delta={percentDelta(
                demoAnalytics.averagePowerKw,
                demoAnalytics.previousAveragePowerKw,
              )}
              note="Mean of valid demo samples in period (null gaps excluded)"
              dataState="DEMO"
            />
            <KpiCard
              label="Load contribution"
              value={
                demoAnalytics.loadRows.length === 1
                  ? `${formatNumber(demoAnalytics.loadRows[0]?.contributionPct, 1)}%`
                  : 'See table'
              }
              note={
                demoAnalytics.loadFilter === 'all'
                  ? 'Per-load % in comparison table'
                  : `${demoAnalytics.includedLoads[0]} share of filtered total`
              }
              dataState="DEMO"
            />
          </section>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Card>
              <CardHeader
                title="Energy consumption by load"
                subtitle={`DEMO DATA · stacked kWh · ${demoAnalytics.chartAggregation} buckets · coverage ${formatNumber(demoAnalytics.coveragePct, 1)}%`}
                action={<StatusBadge state="DEMO" compact />}
              />
              <EnergyByLoadChart
                data={demoAnalytics.energySeries}
                loads={demoAnalytics.includedLoads}
                aggregation={demoAnalytics.chartAggregation}
              />
            </Card>
            <Card>
              <CardHeader
                title={
                  demoAnalytics.chartAggregation === 'daily'
                    ? 'Average power by day'
                    : 'Site power profile'
                }
                subtitle={
                  demoAnalytics.chartAggregation === 'daily'
                    ? 'DEMO DATA · daily mean of valid hourly kW · not billing demand'
                    : 'DEMO DATA · hourly site kW · not a verified demand interval'
                }
                action={<StatusBadge state="DEMO" compact />}
              />
              <DemandProfileChart
                data={demoAnalytics.demandSeries}
                aggregation={demoAnalytics.chartAggregation}
              />
              <p className="mt-2 text-[11px] text-text-secondary">
                {demoAnalytics.demandIntervalNote}
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
                  {demoAnalytics.loadRows.map((row) => {
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

function KpiCard({
  label,
  value,
  delta,
  note,
  dataState,
}: {
  label: string
  value: string
  delta?: number | null
  note?: string
  dataState: DataQualityState
}) {
  return (
    <Card className="flex min-h-[120px] flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        <StatusBadge state={dataState} compact />
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
