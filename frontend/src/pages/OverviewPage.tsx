import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Wifi } from 'lucide-react'
import {
  apiClient,
  type ApiOverviewResponse,
  type ApiGatewayConnectionStatusResponse,
} from '@/api/client'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { StackedPowerChart } from '@/components/charts/StackedPowerChart'
import { Card, CardHeader } from '@/components/ui/Card'
import { KpiCard } from '@/components/ui/KpiCard'
import { LoadCard } from '@/components/ui/LoadCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { SeverityBadge } from '@/components/ui/SeverityBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatTimestamp, relativeAge } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { DataQualityState, KpiSnapshot, LoadElectricalReading, LoadId, PowerSeriesPoint } from '@/types'

export function OverviewPage() {
  // Real data states exclusively
  const [realOverview, setRealOverview] = useState<ApiOverviewResponse | null>(null)
  const [realLoads, setRealLoads] = useState<LoadElectricalReading[]>([])
  const [gatewayStatus, setGatewayStatus] = useState<ApiGatewayConnectionStatusResponse['gateway'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchRealTelemetry() {
      try {
        const [overviewRes, loadsRes, gatewayRes] = await Promise.all([
          apiClient.getOverview('REAL'),
          apiClient.getLoads('REAL'),
          apiClient.getGatewayStatus().catch(() => null),
        ])

        if (cancelled) return

        // Per-load telemetry calls
        const loadReadings: LoadElectricalReading[] = await Promise.all(
          loadsRes.loads.map(async (catLoad) => {
            try {
              const detail = await apiClient.getLoadDetail(catLoad.id, 'REAL')
              return {
                loadId: (catLoad.code || catLoad.id) as LoadId,
                dataState: (detail.data_state as DataQualityState) || 'NO_DATA',
                asOf: detail.as_of ?? '',
                activePowerKw: detail.measurements.active_power_kw,
                currentA: detail.measurements.current_a,
                voltageV: detail.measurements.voltage_v,
                powerFactor: detail.measurements.power_factor,
                frequencyHz: detail.measurements.frequency_hz,
                energyTodayKwh: detail.measurements.active_import_kwh,
              }
            } catch {
              return {
                loadId: (catLoad.code || catLoad.id) as LoadId,
                dataState: 'NO_DATA' as DataQualityState,
                asOf: '',
                activePowerKw: null,
                currentA: null,
                voltageV: null,
                powerFactor: null,
                frequencyHz: null,
                energyTodayKwh: null,
              }
            }
          }),
        )

        if (cancelled) return
        setRealOverview(overviewRes)
        setRealLoads(loadReadings)
        if (gatewayRes) setGatewayStatus(gatewayRes.gateway)
        setError(null)
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to fetch operational telemetry.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchRealTelemetry()
    const timer = setInterval(fetchRealTelemetry, 6000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  // 5 Canonical Real-Data KPIs
  const activeKpis: KpiSnapshot[] = realOverview
    ? [
        {
          id: 'total-power',
          label: 'Total power',
          value: realOverview.total_active_power_kw,
          unit: 'kW',
          asOf: realOverview.as_of ?? '',
          dataState: realOverview.data_state as DataQualityState,
          note: realOverview.incomplete
            ? realOverview.missing_loads?.length
              ? `Incomplete: missing ${realOverview.missing_loads.join(', ')}`
              : 'Incomplete: unverified inputs'
            : 'Verified site sum',
        },
        {
          id: 'energy-today',
          label: 'Energy today',
          value: null,
          unit: 'kWh',
          asOf: realOverview.as_of ?? '',
          dataState: 'NO_DATA',
          note: 'Counter unverified in Phase 2b',
        },
        {
          id: 'peak-demand',
          label: 'Peak power',
          value: null,
          unit: 'kW',
          asOf: realOverview.as_of ?? '',
          dataState: 'NO_DATA',
          note: 'Hourly max today · Interval TBD',
        },
        {
          id: 'aggregate-pf',
          label: 'Aggregate PF',
          value: realOverview.aggregate_pf,
          unit: '',
          asOf: realOverview.as_of ?? '',
          dataState: (realOverview.aggregate_pf !== null ? 'UNKNOWN' : 'NO_DATA') as DataQualityState,
          note:
            realOverview.aggregate_pf === null
              ? 'Inputs unverified or missing'
              : 'Verified ratio (kW / kVA)',
        },
        {
          id: 'active-alarms',
          label: 'Open alarms',
          value: (realOverview.top_alarms as unknown[])?.length ?? 0,
          unit: '',
          asOf: realOverview.as_of ?? '',
          dataState: (realOverview.data_state as DataQualityState) ?? 'NO_DATA',
          note: 'Active + acknowledged',
        },
      ]
    : [
        {
          id: 'total-power',
          label: 'Total power',
          value: null,
          unit: 'kW',
          asOf: '',
          dataState: 'NO_DATA',
          note: 'Awaiting telemetry',
        },
        {
          id: 'energy-today',
          label: 'Energy today',
          value: null,
          unit: 'kWh',
          asOf: '',
          dataState: 'NO_DATA',
          note: 'Counter unverified',
        },
        {
          id: 'peak-demand',
          label: 'Peak power',
          value: null,
          unit: 'kW',
          asOf: '',
          dataState: 'NO_DATA',
          note: 'Interval TBD',
        },
        {
          id: 'aggregate-pf',
          label: 'Aggregate PF',
          value: null,
          unit: '',
          asOf: '',
          dataState: 'NO_DATA',
          note: 'Inputs unverified',
        },
        {
          id: 'active-alarms',
          label: 'Open alarms',
          value: 0,
          unit: '',
          asOf: '',
          dataState: 'NO_DATA',
          note: 'Active + acknowledged',
        },
      ]

  const activeDataState: DataQualityState =
    (realOverview?.data_state as DataQualityState) ?? 'NO_DATA'

  const bannerMessage = error
    ? `Cannot reach backend telemetry API: ${error}. Showing offline state.`
    : realOverview?.data_state === 'NO_DATA'
      ? 'Operational telemetry active · Waiting for live meter samples from gateway bridge.'
      : 'Operational telemetry active · Decoded measurements reflect verified meter mappings.'

  // Extract individual KPIs for responsive mobile composition
  const kpiTotalPower = activeKpis.find((k) => k.id === 'total-power') || activeKpis[0]
  const kpiEnergyToday = activeKpis.find((k) => k.id === 'energy-today') || activeKpis[1]
  const kpiPeakPower = activeKpis.find((k) => k.id === 'peak-demand') || activeKpis[2]
  const kpiAggregatePf = activeKpis.find((k) => k.id === 'aggregate-pf') || activeKpis[3]
  const kpiOpenAlarms = activeKpis.find((k) => k.id === 'active-alarms') || activeKpis[4]

  const realSeries = (realOverview?.power_series ?? []) as PowerSeriesPoint[]
  const realAlarms = (realOverview?.top_alarms ?? []) as Array<{
    id: string
    title: string
    severity: 'critical' | 'warning' | 'info'
    status: string
    loadId?: string | null
    raisedAt: string
  }>

  return (
    <div className="space-y-4 sm:space-y-6 pb-28 md:pb-8">
      {/* Overview Page Header */}
      <PageHeader
        title="Overview"
        description="Real-time electrical monitoring · No load control"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge state={activeDataState} />
          </div>
        }
      />

      {/* Global Data State Banner */}
      <DataStateBanner
        state={activeDataState}
        message={bannerMessage}
      />

      {/* ========================================================================= */}
      {/* KPI Section */}
      {/* ========================================================================= */}
      {loading && activeKpis.length === 0 ? (
        <div className="rounded-[10px] border border-border/80 bg-card p-6 text-center text-sm text-text-secondary shadow-2xs">
          Loading operational telemetry…
        </div>
      ) : (
        <>
          {/* KPI Section — one set of cards, mobile + desktop layouts */}
          <section
            className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-5"
            aria-label="Key performance indicators"
          >
            {kpiTotalPower && <KpiCard kpi={kpiTotalPower} />}
            {kpiEnergyToday && <KpiCard kpi={kpiEnergyToday} to="/energy" />}
            {kpiPeakPower && <KpiCard kpi={kpiPeakPower} />}
            {kpiAggregatePf && <KpiCard kpi={kpiAggregatePf} />}
            {kpiOpenAlarms && <KpiCard kpi={kpiOpenAlarms} to="/alarms" />}
          </section>
        </>
      )}

      {/* ========================================================================= */}
      {/* Loads Section */}
      {/* ========================================================================= */}
      <section aria-label="Equipment loads">
        <div className="mb-2.5 sm:mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-text">Equipment loads</h2>
            <span className="rounded-full border border-border/70 bg-surface px-2 py-0.5 text-[11px] font-medium text-text-secondary">
              {realLoads.length} configured
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {realLoads.map((load) => (
            <LoadCard key={load.loadId} reading={load} />
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* Power Chart + Alarms Section */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 24-hour Power Chart Card */}
        <Card className="rounded-[10px] border border-border/80 bg-card p-4 sm:p-5 shadow-2xs lg:col-span-2">
          <CardHeader
            title="24-hour power by load"
            subtitle="Hourly power trend by load"
            className="mb-3"
          />
          {realSeries.length > 0 ? (
            <StackedPowerChart data={realSeries} />
          ) : (
            <div className="flex h-[260px] sm:h-[300px] w-full flex-col items-center justify-center rounded-[8px] border border-dashed border-border/80 bg-surface/30 p-6 text-center">
              <p className="text-sm font-semibold text-text">No telemetry series accumulated yet</p>
              <p className="mt-1 max-w-sm text-xs text-text-secondary">
                Live time-series rollups will graph here once decoded samples are received from the gateway.
              </p>
            </div>
          )}
        </Card>

        {/* Open Alarms Card */}
        <Card className="flex flex-col justify-between rounded-[10px] border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
          <div>
            <CardHeader
              title="Open alarms"
              subtitle="Active and acknowledged issues"
              action={
                <Link
                  to="/alarms"
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline active:scale-95 transition-all"
                >
                  View all
                  <ChevronRight className="h-3 w-3" />
                </Link>
              }
              className="mb-3"
            />
            {realAlarms.length === 0 ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[8px] border border-dashed border-border/80 bg-surface/30 p-6 text-center">
                <p className="text-sm font-semibold text-text">No active alarms</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {activeDataState === 'NO_DATA'
                    ? 'Alarm evaluation unavailable — no valid telemetry input.'
                    : 'All monitored parameters within nominal operating thresholds.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {realAlarms.map((alarm) => (
                  <li key={alarm.id}>
                    <Link
                      to="/alarms"
                      className="block rounded-[8px] border border-border/70 bg-surface/40 p-2.5 transition-all hover:border-border hover:bg-surface/80 active:scale-[0.98]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <SeverityBadge severity={alarm.severity} />
                        <span className="text-[10px] font-medium text-text-secondary">
                          {formatTimestamp(alarm.raisedAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs font-semibold text-text leading-snug">
                        {alarm.title}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-text-secondary">
                        <span className="font-medium text-text">{alarm.loadId ?? 'Site'}</span>
                        <span className="capitalize">{alarm.status}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </section>

      {/* ========================================================================= */}
      {/* Gateway Connection Section */}
      {/* ========================================================================= */}
      <section aria-label="Gateway communication">
        <Card className="rounded-[10px] border border-border bg-card shadow-sm">
          <div className="px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-border/80 bg-surface text-text-secondary shadow-2xs">
                  <Wifi className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">
                    {gatewayStatus?.name ?? realOverview?.gateway?.name ?? 'Site Gateway'}
                  </p>
                  <p className="text-[10px] text-text-secondary">
                    MAC: {gatewayStatus?.mac ?? '—'} · Firmware: {gatewayStatus?.firmware_version ?? '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {gatewayStatus ? (
                  <>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase',
                        gatewayStatus.connection_state === 'ONLINE' ||
                          gatewayStatus.connection_state === 'DATA_RECEIVING'
                          ? 'border border-success/30 bg-success/10 text-success'
                          : gatewayStatus.connection_state === 'STALE' ||
                            gatewayStatus.connection_state === 'CONNECTED_NO_DATA'
                            ? 'border border-amber-500/30 bg-amber-500/10 text-amber-700'
                            : gatewayStatus.connection_state === 'OFFLINE' ||
                              gatewayStatus.connection_state === 'INGEST_ERROR'
                              ? 'border border-critical/30 bg-critical/10 text-critical'
                              : 'border border-border bg-surface text-text-secondary',
                      )}
                    >
                      {gatewayStatus.connection_state.replace(/_/g, ' ')}
                    </span>
                    <Link
                      to="/gateway"
                      className="text-[10px] text-accent hover:underline"
                    >
                      View Details
                    </Link>
                  </>
                ) : (
                  <StatusBadge state="NO_DATA" compact />
                )}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 sm:gap-3">
              <div className="rounded-[8px] border border-border/60 bg-surface/50 p-2.5">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                  Last Heartbeat
                </dt>
                <dd className="mt-1 tabular text-[10px] font-medium text-text-secondary">
                  {gatewayStatus?.last_heartbeat_at
                    ? `${formatTimestamp(gatewayStatus.last_heartbeat_at)} · ${relativeAge(gatewayStatus.last_heartbeat_at)}`
                    : 'Never'}
                </dd>
              </div>
              <div className="rounded-[8px] border border-border/60 bg-surface/50 p-2.5">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                  Last Telemetry
                </dt>
                <dd className="mt-1 tabular text-[10px] font-medium text-text-secondary">
                  {gatewayStatus?.last_telemetry_at
                    ? `${formatTimestamp(gatewayStatus.last_telemetry_at)} · ${relativeAge(gatewayStatus.last_telemetry_at)}`
                    : 'Never'}
                </dd>
              </div>
              <div className="rounded-[8px] border border-border/60 bg-surface/50 p-2.5">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                  Meters Reporting
                </dt>
                <dd className="mt-1 tabular font-semibold text-text">
                  {`${realOverview?.loads_reporting ?? 0} / ${realOverview?.loads_expected ?? 0}`}
                </dd>
              </div>
              <div className="rounded-[8px] border border-border/60 bg-surface/50 p-2.5">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                  Total Heartbeats
                </dt>
                <dd className="mt-1 tabular font-semibold text-text">
                  {gatewayStatus?.totals.heartbeats ?? 0}
                </dd>
              </div>
            </dl>
          </div>
        </Card>
      </section>
    </div>
  )
}
