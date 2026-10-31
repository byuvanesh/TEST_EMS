import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, History } from 'lucide-react'
import { useAlarmStore } from '@/context/AlarmStore'
import { useDataSource } from '@/context/DataSourceContext'
import {
  apiClient,
  type ApiLoadDetailResponse,
  type ApiLoadHistoryResponse,
} from '@/api/client'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { buildOverviewData } from '@/mock/demoData'
import { getLoadDefinition, LOAD_DEFINITIONS } from '@/config/loads'
import { formatNumber, formatPowerFactor, formatTimestamp } from '@/lib/format'
import type { DataQualityState } from '@/types'

const LOAD_IDS = LOAD_DEFINITIONS.map((l) => l.id)

export function LoadDetailPage() {
  const { loadId } = useParams<{ loadId: string }>()
  const { openAlarms } = useAlarmStore()
  const { isReal } = useDataSource()

  const [realDetail, setRealDetail] = useState<ApiLoadDetailResponse | null>(null)
  const [realHistory, setRealHistory] = useState<ApiLoadHistoryResponse | null>(null)
  const [loading, setLoading] = useState(isReal)
  const [error, setError] = useState<string | null>(null)

  const def = loadId ? getLoadDefinition(loadId) : undefined

  useEffect(() => {
    if (!isReal || !loadId) return
    const idToFetch = loadId

    let cancelled = false

    async function fetchLoadData() {
      try {
        const [detailRes, historyRes] = await Promise.all([
          apiClient.getLoadDetail(idToFetch, 'REAL'),
          apiClient.getLoadHistory(idToFetch, 25, 'REAL'),
        ])
        if (!cancelled) {
          setRealDetail(detailRes)
          setRealHistory(historyRes)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to fetch load telemetry.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchLoadData()
    const timer = setInterval(fetchLoadData, 6000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [isReal, loadId])

  // Demo fallback
  const demoReading = buildOverviewData(openAlarms).loads.find(
    (l) => l.loadId === loadId,
  )

  if (!def && !realDetail) {
    return (
      <div className="space-y-5">
        <PageHeader title="Load not found" />
        <EmptyState
          title="Unknown load"
          description="Use Overview load cards or a valid load identifier."
        />
        <Link to="/" className="text-sm font-medium text-accent hover:underline">
          Back to Overview
        </Link>
      </div>
    )
  }

  const loadName = isReal
    ? realDetail?.load?.name ?? def?.name ?? loadId ?? 'Load Detail'
    : def?.name ?? loadId ?? 'Load Detail'

  const capacityLabel = isReal
    ? realDetail?.load?.capacity_label ?? def?.capacityLabel ?? '—'
    : def?.capacityLabel ?? '—'

  const dataState: DataQualityState = isReal
    ? (realDetail?.data_state as DataQualityState) ?? 'NO_DATA'
    : demoReading?.dataState ?? 'DEMO'

  const asOf = isReal ? realDetail?.as_of ?? null : demoReading?.asOf ?? null

  const measurements = isReal
    ? realDetail?.measurements
    : demoReading
      ? {
          active_power_kw: demoReading.activePowerKw,
          current_a: demoReading.currentA,
          voltage_v: demoReading.voltageV,
          power_factor: demoReading.powerFactor,
          frequency_hz: demoReading.frequencyHz,
          active_import_kwh: demoReading.energyTodayKwh,
        }
      : null

  const index = loadId ? LOAD_IDS.indexOf(loadId as (typeof LOAD_IDS)[number]) : -1
  const prev = index > 0 ? LOAD_IDS[index - 1] : null
  const next = index >= 0 && index < LOAD_IDS.length - 1 ? LOAD_IDS[index + 1] : null

  return (
    <div className="space-y-5">
      <PageHeader
        title={loadName}
        description={`${capacityLabel} · Electrical monitoring only`}
        breadcrumbs={
          <nav className="flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
            <Link to="/" className="hover:text-accent">
              Overview
            </Link>
            <span>/</span>
            <span className="text-text">{loadName}</span>
          </nav>
        }
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge state={dataState} />
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
        state={dataState}
        message={
          isReal
            ? error
              ? `Error connecting to telemetry: ${error}`
              : dataState === 'NO_DATA'
                ? 'No telemetry decoded yet for this load. Waiting for live samples from the gateway bridge.'
                : 'Displaying decoded telemetry from verified meter mappings.'
            : 'DEMO readings from the shared canonical series. Energy today matches Overview and Energy page for this load.'
        }
      />

      {loading && isReal && !realDetail ? (
        <div className="rounded-[10px] border border-border bg-card p-6 text-center text-sm text-text-secondary">
          Loading load telemetry…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Active power"
              value={
                measurements?.active_power_kw !== null &&
                measurements?.active_power_kw !== undefined
                  ? `${formatNumber(measurements.active_power_kw, 1)} kW`
                  : '—'
              }
              asOf={asOf}
              state={dataState}
            />
            <MetricCard
              label="Current"
              value={
                measurements?.current_a !== null &&
                measurements?.current_a !== undefined
                  ? `${formatNumber(measurements.current_a, 1)} A`
                  : '—'
              }
              asOf={asOf}
              state={dataState}
            />
            <MetricCard
              label="Voltage"
              value={
                measurements?.voltage_v !== null &&
                measurements?.voltage_v !== undefined
                  ? `${formatNumber(measurements.voltage_v, 0)} V`
                  : '—'
              }
              asOf={asOf}
              state={dataState}
            />
            <MetricCard
              label="Power factor"
              value={formatPowerFactor(measurements?.power_factor)}
              asOf={asOf}
              state={dataState}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Additional electrical"
                subtitle={
                  isReal
                    ? 'Decoded metrics from meter registers'
                    : 'Frequency and energy today (demo · shared series)'
                }
              />
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-text-secondary">Frequency</dt>
                  <dd className="tabular mt-1 font-semibold text-text">
                    {measurements?.frequency_hz !== null &&
                    measurements?.frequency_hz !== undefined
                      ? `${formatNumber(measurements.frequency_hz, 1)} Hz`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">Energy today</dt>
                  <dd className="tabular mt-1 font-semibold text-text">
                    {measurements?.active_import_kwh !== null &&
                    measurements?.active_import_kwh !== undefined
                      ? `${formatNumber(measurements.active_import_kwh, 1)} kWh`
                      : '—'}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card>
              <EmptyState
                title="Advanced parameters"
                description="Per-phase values, THD, and unbalance render only when future meter capability is verified."
              />
            </Card>
          </div>

          {/* Real Telemetry History Section */}
          {isReal ? (
            <Card>
              <CardHeader
                title="Recent Telemetry History"
                subtitle="Recent decoded samples from database (GET /api/loads/:id/history)"
                action={
                  <span className="flex items-center gap-1 text-xs text-text-secondary">
                    <History className="h-3.5 w-3.5" />
                    {realHistory?.count ?? 0} samples
                  </span>
                }
              />
              {realHistory && realHistory.samples.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-text-secondary">
                        <th className="py-2.5 pr-4 font-medium">Sample Time</th>
                        <th className="py-2.5 px-3 font-medium">Active Power (kW)</th>
                        <th className="py-2.5 px-3 font-medium">Current (A)</th>
                        <th className="py-2.5 px-3 font-medium">Voltage (V)</th>
                        <th className="py-2.5 px-3 font-medium">PF</th>
                        <th className="py-2.5 px-3 font-medium">Frequency (Hz)</th>
                        <th className="py-2.5 pl-3 font-medium">Energy (kWh)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {realHistory.samples.map((sample, idx) => (
                        <tr key={idx} className="hover:bg-surface/50">
                          <td className="py-2.5 pr-4 font-mono text-[11px] text-text-secondary whitespace-nowrap">
                            {formatTimestamp(sample.sample_time)}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-text">
                            {sample.active_power_kw !== null ? formatNumber(sample.active_power_kw, 2) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-text">
                            {sample.current_a !== null ? formatNumber(sample.current_a, 2) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-text">
                            {sample.voltage_v !== null ? formatNumber(sample.voltage_v, 1) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-text">
                            {formatPowerFactor(sample.power_factor)}
                          </td>
                          <td className="py-2.5 px-3 text-text">
                            {sample.frequency_hz !== null ? formatNumber(sample.frequency_hz, 1) : '—'}
                          </td>
                          <td className="py-2.5 pl-3 text-text">
                            {sample.active_import_kwh !== null ? formatNumber(sample.active_import_kwh, 2) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4">
                  <EmptyState
                    title="No telemetry history recorded yet"
                    description="Decoded samples will appear in this history table as they are archived and decoded."
                  />
                </div>
              )}
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  asOf,
  state,
}: {
  label: string
  value: string
  asOf?: string | null
  state: DataQualityState
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        <StatusBadge state={state} compact />
      </div>
      <p className="tabular mt-3 text-[28px] font-semibold leading-none text-text">
        {value}
      </p>
      <FreshnessIndicator asOf={asOf} className="mt-3" />
    </Card>
  )
}
