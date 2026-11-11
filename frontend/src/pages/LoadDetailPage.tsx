import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, History } from 'lucide-react'
import {
  apiClient,
  type ApiLoadDetailResponse,
  type ApiLoadHistoryResponse,
} from '@/api/client'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatNumber, formatPowerFactor, formatTimestamp } from '@/lib/format'
import { getLoadDefinition, LOAD_DEFINITIONS } from '@/config/loads'
import { resolveLoadIdentifier } from '@/lib/loadResolver'
import type { DataQualityState } from '@/types'
import { ParameterCard } from '@/components/ParameterCard'

const LOAD_IDS = LOAD_DEFINITIONS.map((l) => l.id)

const PARAMETER_CATALOGUE = [
  { key: 'voltage_l1', label: 'L1 Voltage', unit: 'V', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'voltage_l2', label: 'L2 Voltage', unit: 'V', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'voltage_l3', label: 'L3 Voltage', unit: 'V', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'current_l1', label: 'L1 Current', unit: 'A', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'current_l2', label: 'L2 Current', unit: 'A', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'current_l3', label: 'L3 Current', unit: 'A', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'active_power_kw', label: 'Active Power', unit: 'kW', decode: 'float32', scale: 0.001, offset: 0.0 },
  { key: 'active_import_kwh', label: 'Energy Import', unit: 'kWh', decode: 'float32', scale: 0.01, offset: 0.0 },
  { key: 'reactive_power_kvar', label: 'Reactive Power', unit: 'kVAR', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'apparent_power_kva', label: 'Apparent Power', unit: 'kVA', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'power_factor', label: 'Power Factor', unit: 'PF', decode: 'float32', scale: 0.01, offset: 0.0 },
  { key: 'frequency_hz', label: 'Frequency', unit: 'Hz', decode: 'float32', scale: 1.0, offset: 0.0 },
] as const

interface MappingItem {
  meter_id: string
  metric: string
  source_keys: string[]
  decode: string
  verification_status: 'UNVERIFIED' | 'VERIFIED'
  verified_at: string | null
}

export function LoadDetailPage() {
  const { loadId: routeMac } = useParams<{ loadId: string }>()

  const [realDetail, setRealDetail] = useState<ApiLoadDetailResponse | null>(null)
  const [realHistory, setRealHistory] = useState<ApiLoadHistoryResponse | null>(null)
  const [mappings, setMappings] = useState<MappingItem[]>([])
  const [gatewayMac, setGatewayMac] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const def = routeMac ? getLoadDefinition(routeMac) : undefined

  useEffect(() => {
    if (!routeMac) return

    let cancelled = false

    async function fetchLoadData() {
      try {
        const loadsRes = await apiClient.getLoads('REAL')
        if (cancelled) return

        const resolution = resolveLoadIdentifier(routeMac, loadsRes?.loads ?? [])
        if (cancelled) return

        if (resolution.isNotFound || !resolution.uuid) {
          setError(`Load '${routeMac}' not found`)
          setRealDetail(null)
          setRealHistory(null)
          setGatewayMac(null)
          setLoading(false)
          return
        }

        setGatewayMac(resolution.uuid)

        const [detailRes, historyRes] = await Promise.all([
          apiClient.getLoadDetail(resolution.uuid, 'REAL'),
          apiClient.getLoadHistory(resolution.uuid, 25, 'REAL'),
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
  }, [routeMac])

  useEffect(() => {
    if (!gatewayMac) return

    let cancelled = false

    async function fetchMappings() {
      try {
        const res = await apiClient.getSystemMapping()
        if (!cancelled) {
          const loadMappings = res.meters.filter(
          (m) => m.id === gatewayMac,
        )
        setMappings(
          loadMappings.flatMap((m) =>
            m.mappings.map((mm) => ({
              meter_id: m.id,
              metric: mm.metric,
              source_keys: mm.source_keys,
              decode: mm.decode,
              verification_status: mm.verification_status,
              verified_at: mm.verified_at,
            })),
          ),
        )
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to fetch metric mappings.')
        }
      }
    }

    fetchMappings()
    return () => {
      cancelled = true
    }
  }, [gatewayMac])

  if (!def && !realDetail && !loading && error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Load not found" />
        <div className="rounded-[6px] border border-dashed border-border/80 bg-surface/30 p-8">
          <EmptyState title="Unknown load" description="Use Overview load cards or a valid load identifier." />
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Overview
          </Link>
        </div>
      </div>
    )
  }

  const loadName = realDetail?.load?.name ?? def?.name ?? routeMac ?? 'Load Detail'
  const capacityLabel = realDetail?.load?.capacity_label ?? def?.capacityLabel ?? '—'
  const dataState: DataQualityState = (realDetail?.data_state as DataQualityState) ?? 'NO_DATA'
  const asOf = realDetail?.as_of ?? null
  const measurements = realDetail?.measurements ?? null

  const currentCode =
    realDetail?.load?.code ??
    (routeMac && getLoadDefinition(routeMac)?.id) ??
    routeMac

  const index = currentCode ? LOAD_IDS.indexOf(currentCode as (typeof LOAD_IDS)[number]) : -1
  const prev = index > 0 ? LOAD_IDS[index - 1] : null
  const next = index >= 0 && index < LOAD_IDS.length - 1 ? LOAD_IDS[index + 1] : null

  const parameterCards = PARAMETER_CATALOGUE.map((param) => {
    const mapping = mappings.find((m) => m.source_keys.includes(param.key))
    const sourceKey = mapping?.source_keys[0] ?? null
    const value = measurements?.[param.key as keyof typeof measurements] ?? null

    return {
      ...param,
      mapping: {
        sourceKey,
        status: (mapping
          ? mapping.verification_status
          : 'NOT_CONFIGURED') as 'VERIFIED' | 'UNVERIFIED' | 'NOT_CONFIGURED',
        verifiedAt: mapping?.verified_at ?? null,
      },
      value,
    }
  })

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={loadName}
        description={`${capacityLabel} · Electrical monitoring only`}
        breadcrumbs={
          <nav className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Link to="/" className="inline-flex items-center gap-1 hover:text-accent font-medium">
              <ArrowLeft className="h-3.5 w-3.5" />
              Overview
            </Link>
            <span>/</span>
            <span className="text-text font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: def?.chartColor ?? '#3B82F6' }} />
              {loadName}
            </span>
          </nav>
        }
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge state={dataState} compact />
            <div className="flex gap-1">
              {prev ? (
                <Link
                  to={`/loads/${prev}`}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-[6px] border border-border/80 bg-surface/50 px-2 py-1 text-xs font-medium text-text-secondary shadow-xs transition-all hover:bg-surface hover:text-text active:scale-95"
                  title={`Previous load: ${prev}`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{prev}</span>
                </Link>
              ) : null}
              {next ? (
                <Link
                  to={`/loads/${next}`}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-[6px] border border-border/80 bg-surface/50 px-2 py-1 text-xs font-medium text-text-secondary shadow-xs transition-all hover:bg-surface hover:text-text active:scale-95"
                  title={`Next load: ${next}`}
                >
                  <span className="hidden sm:inline">{next}</span>
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
          error
            ? `Error connecting to telemetry: ${error}`
            : dataState === 'NO_DATA'
              ? 'No telemetry decoded yet for this load. Waiting for live samples from the gateway bridge.'
              : 'Displaying decoded telemetry from verified meter mappings.'
        }
      />

      {loading && !realDetail ? (
        <div className="rounded-[10px] border border-border bg-card p-6 text-center text-sm text-text-secondary">
          Loading load telemetry…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
            {parameterCards.slice(0, 4).map((p) => (
              <ParameterCard key={p.key} parameter={p} mapping={p.mapping} value={p.value} asOf={asOf} />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-2">
            {parameterCards.slice(4).map((p) => (
              <ParameterCard key={p.key} parameter={p} mapping={p.mapping} value={p.value} asOf={asOf} />
            ))}
          </div>

          <Card className="p-3.5 sm:p-4">
            <div className="border-b border-border px-4 py-3 sm:px-5 sm:py-4">
              <CardHeader
                title="Recent Telemetry History"
                subtitle="Recent decoded samples from database"
                action={
                  <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <History className="h-3.5 w-3.5" />
                    {realHistory?.count ?? 0} samples
                  </span>
                }
              />
            </div>
            {realHistory && realHistory.samples && realHistory.samples.length > 0 ? (
              <>
                <div className="divide-y divide-border md:hidden">
                  {realHistory.samples.map((sample, idx) => (
                    <div key={idx} className="p-3.5 bg-card">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-text-secondary">
                          {formatTimestamp(sample.sample_time)}
                        </span>
                        <span className="tabular text-xs font-bold text-text">
                          {sample.active_power_kw !== null ? `${formatNumber(sample.active_power_kw, 2)} kW` : '—'}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px] text-text-secondary border-t border-border/50 pt-2">
                        <div>
                          <span className="text-text-secondary">Current:</span>
                          <span className="tabular font-medium text-text">
                            {sample.current_a !== null ? `${formatNumber(sample.current_a, 1)} A` : '—'}
                          </span>
                        </div>
                        <div>
                          <span>Voltage: </span>
                          <span className="tabular font-medium text-text">
                            {sample.voltage_v !== null ? `${formatNumber(sample.voltage_v, 1)} V` : '—'}
                          </span>
                        </div>
                        <div>
                          <span>PF: </span>
                          <span className="tabular font-medium text-text">
                            {formatPowerFactor(sample.power_factor)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border/70">
                      <tr className="border-b border-border/70">
                        <th className="pb-2.5 px-4 font-medium">Sample Time</th>
                        <th className="py-2.5 px-3 font-medium">Active Power (kW)</th>
                        <th className="py-2.5 px-3 font-medium">Current (A)</th>
                        <th className="py-2.5 px-3 font-medium">Voltage (V)</th>
                        <th className="py-2.5 px-3 font-medium">PF</th>
                        <th className="py-2.5 px-3 font-medium">Frequency (Hz)</th>
                        <th className="py-2.5 px-4 font-medium">Energy (kWh)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {realHistory.samples.map((sample, idx) => (
                        <tr key={idx} className="transition-colors hover:bg-surface/50">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-text-secondary whitespace-nowrap">
                            {formatTimestamp(sample.sample_time)}
                          </td>
                          <td className="tabular tabular-nums py-2.5 px-3 font-semibold text-text">
                            {sample.active_power_kw !== null ? formatNumber(sample.active_power_kw, 2) : '—'}
                          </td>
                          <td className="tabular tabular-nums py-2.5 px-3 text-text">
                            {sample.current_a !== null ? formatNumber(sample.current_a, 2) : '—'}
                          </td>
                          <td className="tabular tabular-nums py-2.5 px-3 text-text">
                            {sample.voltage_v !== null ? formatNumber(sample.voltage_v, 1) : '—'}
                          </td>
                          <td className="tabular tabular-nums py-2.5 px-3 text-text">
                            {formatPowerFactor(sample.power_factor)}
                          </td>
                          <td className="tabular tabular-nums py-2.5 px-3 text-text">
                            {sample.frequency_hz !== null ? formatNumber(sample.frequency_hz, 1) : '—'}
                          </td>
                          <td className="tabular tabular-nums py-2.5 px-4 text-text">
                            {sample.active_import_kwh !== null ? formatNumber(sample.active_import_kwh, 2) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-6">
                <div className="rounded-[8px] border border-dashed border-border/80 bg-surface/30 p-6 text-center">
                  <EmptyState title="No telemetry history recorded yet" description="Decoded samples will appear in this history table as they are archived and decoded." />
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}