import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download } from 'lucide-react'
import { apiClient, type ApiEnergyResponse, type ApiCatalogueLoad } from '@/api/client'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SelectField } from '@/components/ui/SelectField'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { KpiCard } from '@/components/ui/KpiCard'
import { buildRealEnergyCsv, downloadTextFile } from '@/lib/energyAnalytics'
import { formatNumber, formatTimestamp } from '@/lib/format'
import { LOAD_DEFINITIONS } from '@/config/loads'
import { cn } from '@/lib/cn'
import type { DataQualityState } from '@/types'

export function EnergyPage() {
  // Real data state
  const [realLoads, setRealLoads] = useState<ApiCatalogueLoad[]>([])
  const [realEnergy, setRealEnergy] = useState<ApiEnergyResponse | null>(null)
  const [realLoading, setRealLoading] = useState(true)
  const [realError, setRealError] = useState<string | null>(null)

  // Filter state
  const [loadFilter, setLoadFilter] = useState<string>('all')

  // Fetch catalogue loads for filter
  useEffect(() => {
    let cancelled = false

    async function fetchLoads() {
      try {
        const loadsRes = await apiClient.getLoads('REAL')
        if (!cancelled && loadsRes?.loads) {
          setRealLoads(loadsRes.loads)
        }
      } catch {
        // Catalogue failure fallback
      }
    }

    fetchLoads()
    return () => {
      cancelled = true
    }
  }, [])

  // Fetch energy telemetry
  useEffect(() => {
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
  }, [loadFilter])

  const loadOptions = useMemo(() => {
    if (realLoads.length > 0) {
      return [
        { value: 'all', label: 'All Loads' },
        ...realLoads.map((l) => ({ value: l.id, label: `${l.code} - ${l.name}` })),
      ]
    }
    return [
      { value: 'all', label: 'All Loads' },
      ...LOAD_DEFINITIONS.map((l) => ({ value: l.id, label: l.name })),
    ]
  }, [realLoads])

  const handleExport = () => {
    if (!realEnergy) return
    const csv = buildRealEnergyCsv(realEnergy, loadFilter)
    downloadTextFile(
      `test-ems-energy-REAL-${loadFilter}-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    )
  }

  const dataState: DataQualityState =
    (realEnergy?.data_state as DataQualityState) || 'NO_DATA'
  const isUnavailable = realEnergy?.availability === 'UNAVAILABLE'
  const hasGaps = Boolean(realEnergy?.has_gaps)

  return (
    <div className="space-y-6">
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
          className="flex items-start gap-2.5 rounded-[8px] border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 leading-relaxed dark:text-amber-200"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            <strong className="font-semibold">Counter GAP detected:</strong> One or more intervals contain counter rollover, reset, or missing samples. Gaps are excluded from consumption totals and never treated as zero.
          </p>
        </div>
      ) : (
        <DataStateBanner
          state={dataState}
          message="Operational energy telemetry active. Readings computed via verified meter counter deltas."
        />
      )}

      {/* Filter Bar */}
      <Card className="p-4 sm:p-5">
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
            className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-border/80 bg-surface/50 px-3.5 text-xs font-medium text-text shadow-xs transition-all hover:bg-surface hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-text-secondary" />
            Export REAL CSV
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border/70 pt-3 text-xs text-text-secondary">
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
        </div>
      </Card>
      {/* Real KPIs - 2 columns on mobile */}
      <section
        className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Energy KPIs"
      >
        <KpiCard
          kpi={{
            id: 'total-energy',
            label: 'Total energy consumption',
            value: isUnavailable || realEnergy?.total_energy_kwh === null || realEnergy?.total_energy_kwh === undefined
              ? null
              : realEnergy.total_energy_kwh,
            unit: 'kWh',
            asOf: '',
            dataState,
            note:
              isUnavailable
                ? 'Counter unverified in Phase 2b'
                : hasGaps
                  ? 'Gaps excluded from total'
                  : 'Verified counter delta',
          }}
        />
        <KpiCard
          kpi={{
            id: 'peak-demand',
            label: 'Peak demand',
            value: null,
            unit: 'kW',
            asOf: '',
            dataState: 'NO_DATA' as DataQualityState,
            note: 'Demand interval TBD — no assumed billing window',
          }}
        />
        <KpiCard
          kpi={{
            id: 'average-power',
            label: 'Average power',
            value: null,
            unit: 'kW',
            asOf: '',
            dataState: 'NO_DATA' as DataQualityState,
            note: 'No verified demand interval in Phase 2b',
          }}
        />
        <KpiCard
          kpi={{
            id: 'intervals-recorded',
            label: 'Intervals recorded',
            value:
              realEnergy?.intervals && realEnergy.intervals.length > 0
                ? realEnergy.intervals.length
                : null,
            unit: 'intervals',
            asOf: '',
            dataState,
            note:
              hasGaps
                ? 'Rollover / reset flagged as GAP'
                : 'Decoded meter deltas',
          }}
        />
      </section>

      {/* Real Interval History & GAP Breakdown */}
      <Card padding="none">
        <div className="border-b border-border px-4 py-3 sm:px-5 sm:py-4">
          <CardHeader
            className="mb-0"
            title="Operational Counter Intervals"
            subtitle="Consecutive active_import_kwh samples (negative/rollover = GAP, not zero)"
          />
        </div>

        {realLoading && !realEnergy ? (
          <div className="p-6 text-center text-sm text-text-secondary">
            Loading energy intervals…
          </div>
        ) : realEnergy && realEnergy.intervals && realEnergy.intervals.length > 0 ? (
          <>
            {/* Mobile Card Feed */}
            <div className="divide-y divide-border md:hidden">
              {realEnergy.intervals.map((interval, idx) => {
                const isGap = interval.status === 'GAP'
                return (
                  <div
                    key={idx}
                    className={cn(
                      'p-3.5 transition-colors',
                      isGap ? 'bg-amber-500/5' : 'bg-card',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-text-secondary">
                        {formatTimestamp(interval.start_time)}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
                          isGap
                            ? 'border border-amber-500/30 bg-amber-500/10 text-amber-700'
                            : 'border border-success/30 bg-success/10 text-success',
                        )}
                      >
                        {isGap ? 'GAP' : 'OK'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-xs text-text-secondary">Energy:</span>
                      <span className="tabular text-base font-bold text-text">
                        {isGap
                          ? '—'
                          : interval.energy_kwh !== null
                            ? `${formatNumber(interval.energy_kwh, 2)} kWh`
                            : '—'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between border-t border-border/50 pt-1.5 font-mono text-[11px] text-text-secondary">
                      <span>Start: {interval.start_kwh !== null ? formatNumber(interval.start_kwh, 1) : '—'}</span>
                      <span>→</span>
                      <span>End: {interval.end_kwh !== null ? formatNumber(interval.end_kwh, 1) : '—'}</span>
                    </div>
                    {isGap && interval.reason && (
                      <p className="mt-1 text-[10px] font-medium text-amber-600">{interval.reason}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desktop 7-Column Table */}
            <div className="hidden md:block overflow-x-auto">
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
          </>
        ) : (
          <div className="p-6">
            <div className="rounded-[6px] border border-dashed border-border/80 bg-surface/30 p-8">
              <EmptyState
                title="No energy intervals available"
                description={
                  isUnavailable
                    ? 'Active import counter telemetry is unverified in Phase 2b. Telemetry samples will be delta-analyzed here once live counter updates arrive.'
                    : 'No telemetry samples recorded for the selected load.'
                }
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
