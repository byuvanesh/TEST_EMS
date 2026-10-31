import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  Bell,
  CheckCircle2,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  apiClient,
  type ApiBridgeStatusResponse,
  type ApiSystemGatewayResponse,
} from '@/api/client'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { Card, CardHeader } from '@/components/ui/Card'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SelectField } from '@/components/ui/SelectField'
import { SeverityBadge } from '@/components/ui/SeverityBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Tabs } from '@/components/ui/Tabs'
import { useAlarmStore } from '@/context/AlarmStore'
import { useDataSource } from '@/context/DataSourceContext'
import {
  ALARM_TYPE_LABELS,
  filterAlarms,
  type AlarmFilterState,
  type AlarmTab,
} from '@/lib/alarmFilters'
import { formatTimestamp } from '@/lib/format'
import { LOAD_DEFINITIONS } from '@/config/loads'
import type { AlarmSeverity, AlarmType, LoadFilter } from '@/types'

const SEVERITY_OPTIONS: { value: AlarmSeverity | 'all'; label: string }[] = [
  { value: 'all', label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
]

const TYPE_OPTIONS: { value: AlarmType | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  ...(Object.keys(ALARM_TYPE_LABELS) as AlarmType[]).map((type) => ({
    value: type,
    label: ALARM_TYPE_LABELS[type],
  })),
]

const LOAD_FILTER_OPTIONS: { value: LoadFilter; label: string }[] = [
  { value: 'all', label: 'All loads' },
  ...LOAD_DEFINITIONS.map((l) => ({
    value: l.id as LoadFilter,
    label: l.name,
  })),
]

export function AlarmsPage() {
  const { isReal } = useDataSource()
  const { alarms, openCount, clearedCount, acknowledge } = useAlarmStore()

  // Real mode gateway & bridge status (reads from already-wired endpoints)
  const [gateway, setGateway] = useState<ApiSystemGatewayResponse | null>(null)
  const [bridge, setBridge] = useState<ApiBridgeStatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(isReal)
  const [, setStatusError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filters, setFilters] = useState<AlarmFilterState>({
    tab: 'active',
    severity: 'all',
    load: 'all',
    type: 'all',
  })

  // In REAL mode: no alarm engine exists yet -> honest empty/NO_DATA state.
  // In DEMO mode: canonical demo alarms with consistent openCount.
  const activeAlarms = isReal ? [] : alarms
  const displayOpenCount = isReal ? 0 : openCount
  const displayClearedCount = isReal ? 0 : clearedCount

  const filtered = useMemo(
    () => (isReal ? [] : filterAlarms(activeAlarms, filters)),
    [isReal, activeAlarms, filters],
  )

  const selected = activeAlarms.find((a) => a.id === selectedId) ?? null

  useEffect(() => {
    if (!isReal) return

    let cancelled = false
    setStatusLoading(true)

    async function fetchCommunicationStatus() {
      try {
        const [gw, br] = await Promise.all([
          apiClient.getSystemGateway().catch(() => null),
          apiClient.getBridgeStatus().catch(() => null),
        ])
        if (!cancelled) {
          setGateway(gw)
          setBridge(br)
          setStatusError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setStatusError((err as Error).message || 'Failed to fetch status')
        }
      } finally {
        if (!cancelled) {
          setStatusLoading(false)
        }
      }
    }

    fetchCommunicationStatus()
    const timer = setInterval(fetchCommunicationStatus, 10000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [isReal])

  const handleAcknowledge = () => {
    if (!selected || selected.status !== 'active') return
    acknowledge(selected.id)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Alarms"
        description={
          isReal
            ? 'Operational electrical alarms and telemetry alerts. Evaluation pipeline pending Phase 2b threshold verification.'
            : 'Demo alarm list only. Thresholds and notification routing are TBD.'
        }
        actions={<StatusBadge state={isReal ? 'NO_DATA' : 'DEMO'} />}
      />

      <DataStateBanner
        state={isReal ? 'NO_DATA' : 'DEMO'}
        message={
          isReal
            ? 'Operational alarm evaluation engine is out of scope for Phase 2b. No operational alarms are fabricated, simulated, or retained from demo state.'
            : 'Acknowledgement updates local DEMO state only — it does not clear a real device alarm or write to a backend.'
        }
      />

      {/* Gateway & Bridge Communication Health card for REAL mode */}
      {isReal && (
        <Card>
          <CardHeader
            title="Gateway & Communication Health"
            subtitle="GET /api/bridge/status & GET /api/system/gateway — communication monitoring only"
            action={
              <StatusBadge
                state={bridge?.status === 'connected' || bridge?.status === 'polling' ? 'LIVE' : 'NO_DATA'}
                compact
              />
            }
          />
          {statusLoading && !gateway && !bridge ? (
            <LoadingState label="Checking gateway communication…" className="p-4" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-[8px] border border-border bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Gateway Link</span>
                    <Radio className="h-4 w-4 text-text-secondary" />
                  </div>
                  <p className="mt-1.5 text-base font-semibold capitalize text-text">
                    {gateway?.gateway.status ?? 'unknown'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-secondary">
                    {gateway?.gateway.name ?? 'Facility Gateway'}
                  </p>
                </div>

                <div className="rounded-[8px] border border-border bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Bridge Connection</span>
                    {bridge?.status === 'connected' || bridge?.status === 'polling' ? (
                      <Wifi className="h-4 w-4 text-success" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-text-secondary" />
                    )}
                  </div>
                  <p className="mt-1.5 text-base font-semibold text-text capitalize">
                    {bridge?.status ?? 'Disconnected'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-secondary">
                    {bridge ? `Mode: ${bridge.mode}` : 'Bridge unavailable'}
                  </p>
                </div>

                <div className="rounded-[8px] border border-border bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Meters Reporting</span>
                    <Activity className="h-4 w-4 text-text-secondary" />
                  </div>
                  <p className="mt-1.5 text-base font-semibold text-text">
                    {gateway ? `${gateway.meters.filter((m) => m.status === 'online').length} / ${gateway.meters.length}` : '—'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-secondary">
                    Gateway-level connectivity
                  </p>
                </div>

                <div className="rounded-[8px] border border-border bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Last Contact</span>
                    <CheckCircle2 className="h-4 w-4 text-text-secondary" />
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-text">
                    {gateway?.gateway.last_receive_time
                      ? formatTimestamp(gateway.gateway.last_receive_time)
                      : bridge?.last_receive_time
                        ? formatTimestamp(bridge.last_receive_time)
                        : 'No payload yet'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-secondary">
                    {bridge ? `${bridge.metrics.archiveInserts} payloads archived` : '—'}
                  </p>
                </div>
              </div>

              <div className="rounded-[8px] bg-surface/50 border border-border/60 p-3 text-xs text-text-secondary">
                <p>
                  <strong>Communication vs Electrical Alarms:</strong> Hardware communication status is reported directly from the local gateway bridge. Real electrical trip limits (overcurrent, undervoltage, power factor thresholds) require an active threshold evaluation engine, which is out of scope for Phase 2b.
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Alarms Table / Empty State Card */}
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <Tabs
            value={filters.tab}
            onChange={(tab: AlarmTab) => setFilters((f) => ({ ...f, tab }))}
            items={[
              { id: 'active', label: 'Open', count: displayOpenCount },
              { id: 'historical', label: 'Historical', count: displayClearedCount },
            ]}
          />
          {!isReal && (
            <div className="flex flex-wrap gap-3">
              <SelectField
                id="alarm-severity"
                label="Severity"
                value={filters.severity}
                options={SEVERITY_OPTIONS}
                onChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    severity: v as AlarmSeverity | 'all',
                  }))
                }
              />
              <SelectField
                id="alarm-load"
                label="Load"
                value={filters.load}
                options={LOAD_FILTER_OPTIONS}
                onChange={(v) =>
                  setFilters((f) => ({ ...f, load: v as LoadFilter }))
                }
              />
              <SelectField
                id="alarm-type"
                label="Type"
                value={filters.type}
                options={TYPE_OPTIONS}
                onChange={(v) =>
                  setFilters((f) => ({ ...f, type: v as AlarmType | 'all' }))
                }
              />
            </div>
          )}
        </div>
      </Card>

      <Card padding="none">
        {isReal ? (
          <EmptyState
            icon={<Bell className="h-8 w-8 text-text-secondary" />}
            title="No operational alarms"
            description="The real-time alarm evaluation engine is not yet deployed (Phase 2b scope: telemetry pipeline and mapping only). No alarms are fabricated or simulated in REAL mode."
            className="m-6"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-8 w-8" />}
            title="No alarms match filters"
            description="Adjust severity, load, or type filters. Historical tab shows cleared demo events only."
            className="m-4"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-surface text-xs text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 font-medium">Alarm</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Load</th>
                  <th className="px-4 py-3 font-medium">Raised</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ack</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((alarm) => (
                  <tr
                    key={alarm.id}
                    className="cursor-pointer border-t border-border hover:bg-surface/70"
                    onClick={() => setSelectedId(alarm.id)}
                  >
                    <td className="px-4 py-3">
                      <SeverityBadge severity={alarm.severity} />
                    </td>
                    <td className="px-4 py-3 font-medium text-text">
                      {alarm.title}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {ALARM_TYPE_LABELS[alarm.type]}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {alarm.loadId ? (
                        <Link
                          to={`/loads/${alarm.loadId}`}
                          className="text-accent hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {alarm.loadId}
                        </Link>
                      ) : (
                        'Site'
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {formatTimestamp(alarm.raisedAt)}
                    </td>
                    <td className="px-4 py-3 capitalize text-text-secondary">
                      {alarm.status}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {alarm.acknowledgedBy ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge state={alarm.dataState} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Alarm Detail Drawer (DEMO mode) */}
      {!isReal && (
        <Drawer
          open={Boolean(selected)}
          title="Alarm detail"
          onClose={() => setSelectedId(null)}
          footer={
            selected?.status === 'active' ? (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-text-secondary">
                  DEMO only — acknowledgement does not clear hardware alarms.
                </p>
                <button
                  type="button"
                  onClick={handleAcknowledge}
                  className="rounded-[8px] bg-accent px-3 py-2 text-xs font-medium text-white hover:opacity-90"
                >
                  Acknowledge (demo)
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-text-secondary">
                {selected?.status === 'acknowledged'
                  ? 'Already acknowledged in local demo state.'
                  : 'Cleared historical demo event — acknowledge disabled.'}
              </p>
            )
          }
        >
          {selected ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={selected.severity} />
                <StatusBadge state={selected.dataState} compact />
                <span className="text-xs capitalize text-text-secondary">
                  {selected.status}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-text">{selected.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  {selected.description}
                </p>
              </div>
              <dl className="grid grid-cols-1 gap-3 text-xs">
                <Detail label="Type" value={ALARM_TYPE_LABELS[selected.type]} />
                <Detail
                  label="Load"
                  value={
                    selected.loadId ? (
                      <Link
                        to={`/loads/${selected.loadId}`}
                        className="text-accent hover:underline"
                      >
                        {selected.loadId}
                      </Link>
                    ) : (
                      'Site / gateway'
                    )
                  }
                />
                <Detail label="Raised" value={formatTimestamp(selected.raisedAt)} />
                <Detail
                  label="Cleared"
                  value={
                    selected.clearedAt
                      ? formatTimestamp(selected.clearedAt)
                      : '—'
                  }
                />
                <Detail
                  label="Acknowledged by"
                  value={selected.acknowledgedBy ?? '—'}
                />
                <Detail
                  label="Acknowledged at"
                  value={
                    selected.acknowledgedAt
                      ? formatTimestamp(selected.acknowledgedAt)
                      : '—'
                  }
                />
                <Detail label="Data quality" value="DEMO DATA" />
              </dl>
            </div>
          ) : null}
        </Drawer>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-border bg-surface px-3 py-2">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="mt-0.5 font-medium text-text">{value}</dd>
    </div>
  )
}
