import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useAlarmStore } from '@/context/AlarmStore'
import { useDataSource } from '@/context/DataSourceContext'
import {
  apiClient,
  type ApiOverviewResponse,
} from '@/api/client'
import { buildOverviewData } from '@/mock/demoData'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { StackedPowerChart } from '@/components/charts/StackedPowerChart'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { KpiCard } from '@/components/ui/KpiCard'
import { LoadCard } from '@/components/ui/LoadCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { SeverityBadge } from '@/components/ui/SeverityBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { DataQualityState, KpiSnapshot, LoadElectricalReading, LoadId } from '@/types'

export function OverviewPage() {
  const { openAlarms } = useAlarmStore()
  const { isReal } = useDataSource()

  // Real data states
  const [realOverview, setRealOverview] = useState<ApiOverviewResponse | null>(null)
  const [realLoads, setRealLoads] = useState<LoadElectricalReading[]>([])
  const [loading, setLoading] = useState(isReal)
  const [error, setError] = useState<string | null>(null)

  // Demo canonical data
  const demoData = buildOverviewData(openAlarms)
  const topDemoAlarms = openAlarms.slice(0, 5)

  useEffect(() => {
    if (!isReal) return

    let cancelled = false

    async function fetchRealTelemetry() {
      try {
        // Decision 2: Fetch /api/overview and GET /api/loads + per-load /api/loads/:id
        const [overviewRes, loadsRes] = await Promise.all([
          apiClient.getOverview('REAL'),
          apiClient.getLoads('REAL'),
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
  }, [isReal])

  // --- Real KPIs ---
  const realKpis: KpiSnapshot[] = realOverview
    ? [
        {
          id: 'total-power',
          label: 'Total active power',
          value: realOverview.total_active_power_kw,
          unit: 'kW',
          asOf: realOverview.as_of ?? '',
          dataState: realOverview.data_state as DataQualityState,
          note: realOverview.incomplete
            ? realOverview.missing_loads?.length
              ? `Incomplete: missing ${realOverview.missing_loads.join(', ')}`
              : 'Incomplete: unverified inputs'
            : 'Verified sum',
        },
        {
          id: 'loads-reporting',
          label: 'Loads reporting',
          value: realOverview.loads_reporting,
          unit: 'loads',
          asOf: realOverview.as_of ?? '',
          dataState: realOverview.data_state as DataQualityState,
          note: `${realOverview.loads_reporting} of ${realOverview.loads_expected} loads reporting`,
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
          id: 'energy-today',
          label: 'Energy today',
          value: null,
          unit: 'kWh',
          asOf: realOverview.as_of ?? '',
          dataState: 'NO_DATA',
          note: 'Counter unverified in Phase 2b',
        },
        {
          id: 'gateway-link',
          label: 'Gateway status',
          value: realOverview.gateway ? 1 : 0,
          unit: '',
          asOf: realOverview.as_of ?? '',
          dataState: (realOverview.data_state as DataQualityState) ?? 'NO_DATA',
          note: realOverview.gateway?.link_state
            ? `Link: ${realOverview.gateway.link_state}`
            : 'Hardware unverified',
        },
      ]
    : []

  const activeKpis = isReal ? realKpis : demoData.kpis
  const activeLoads = isReal ? realLoads : demoData.loads
  const activeDataState: DataQualityState = isReal
    ? (realOverview?.data_state as DataQualityState) ?? 'NO_DATA'
    : demoData.globalDataState

  const bannerMessage = isReal
    ? error
      ? `Cannot reach backend telemetry API: ${error}. Showing offline state.`
      : realOverview?.data_state === 'NO_DATA'
        ? 'Operational data source active. Telemetry status: NO_DATA. Waiting for live samples from the gateway bridge.'
        : 'Operational data source active. Decoded measurements reflect verified meter mappings.'
    : 'All values on this screen are DEMO DATA from one shared series. Energy today matches the Energy page (incomplete day through the DEMO snapshot). Not live meters.'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        description="Site electrical summary. Electrical monitoring only — no load control."
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge state={activeDataState} />
          </div>
        }
      />

      <DataStateBanner
        state={activeDataState}
        message={bannerMessage}
      />

      {/* KPI Section */}
      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        aria-label="Key performance indicators"
      >
        {loading && isReal && activeKpis.length === 0 ? (
          <div className="col-span-full rounded-[10px] border border-border bg-card p-6 text-center text-sm text-text-secondary">
            Loading operational telemetry…
          </div>
        ) : (
          activeKpis.map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} />
          ))
        )}
      </section>

      {/* Loads Section */}
      <section aria-label="Loads">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Loads</h2>
          <StatusBadge state={activeDataState} compact />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {activeLoads.map((load) => (
            <LoadCard key={load.loadId} reading={load} />
          ))}
        </div>
      </section>

      {/* Power chart + Alarms section */}
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="24-hour power by load"
            subtitle={
              isReal
                ? 'REAL DATA · hourly rollup · missing loads appear as gaps, not zero'
                : 'DEMO DATA · canonical series · per-load lines · missing load = gap (not zero)'
            }
            action={<StatusBadge state={activeDataState} compact />}
          />
          {isReal ? (
            <div className="p-4">
              <EmptyState
                title="No 24-hour real telemetry series yet"
                description="Live time-series rollups will appear here as decoded samples accumulate over time. Aggregation is honest — missing loads will produce gaps, not zeros."
              />
            </div>
          ) : (
            <StackedPowerChart data={demoData.powerSeries} />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Open alarms"
            subtitle={
              isReal
                ? 'Operational alarms · real-time thresholds'
                : 'Active + acknowledged · DEMO thresholds'
            }
            action={
              <Link to="/alarms" className="text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            }
          />
          {isReal ? (
            <div className="p-4">
              <EmptyState
                title="No active alarms"
                description="Operational alarm evaluation pipeline is pending Phase 2b threshold verification."
              />
            </div>
          ) : (
            <ul className="space-y-2">
              {topDemoAlarms.map((alarm) => (
                <li
                  key={alarm.id}
                  className="rounded-[8px] border border-border bg-surface px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <SeverityBadge severity={alarm.severity} />
                    <StatusBadge state={alarm.dataState} compact />
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-text">{alarm.title}</p>
                  <p className="mt-1 text-[11px] text-text-secondary">
                    {alarm.loadId ?? 'Site'} · {formatTimestamp(alarm.raisedAt)} ·{' '}
                    {alarm.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Gateway communication */}
      <section aria-label="Gateway communication">
        <Card>
          <CardHeader
            title="Gateway & communication"
            subtitle={
              isReal
                ? 'Operational gateway connection status'
                : 'Unverified hardware status — DEMO DATA only'
            }
            action={
              <StatusBadge
                state={isReal ? (realOverview?.data_state as DataQualityState) ?? 'NO_DATA' : demoData.gateway.dataState}
                compact
              />
            }
          />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-surface text-text-secondary">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">
                  {isReal
                    ? realOverview?.gateway?.name ?? 'Facility Gateway'
                    : demoData.gateway.name}
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {isReal
                    ? realOverview?.gateway?.note ?? 'Hardware communication status'
                    : demoData.gateway.note}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:text-right">
              <div>
                <dt className="text-text-secondary">Link state</dt>
                <dd
                  className={cn(
                    'mt-0.5 font-medium capitalize',
                    (isReal ? realOverview?.gateway?.link_state : demoData.gateway.linkState) === 'unknown'
                      ? 'text-text-secondary'
                      : 'text-text',
                  )}
                >
                  {isReal
                    ? realOverview?.gateway?.link_state ?? 'unknown'
                    : demoData.gateway.linkState}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Meters reporting</dt>
                <dd className="tabular mt-0.5 font-medium text-text">
                  {isReal
                    ? `${realOverview?.loads_reporting ?? 0} / ${realOverview?.loads_expected ?? 0}`
                    : `${demoData.gateway.metersOnline} / ${demoData.gateway.metersTotal}`}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-text-secondary">Last heard</dt>
                <dd className="mt-0.5 font-medium text-text-secondary">
                  {isReal
                    ? realOverview?.as_of
                      ? formatTimestamp(realOverview.as_of)
                      : 'No telemetry yet'
                    : demoData.gateway.lastHeardAt
                      ? formatTimestamp(demoData.gateway.lastHeardAt)
                      : 'Not available (demo)'}
                </dd>
              </div>
            </dl>
          </div>
        </Card>
      </section>
    </div>
  )
}
