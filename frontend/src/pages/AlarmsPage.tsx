import { useMemo, useState, type ReactNode } from 'react'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { Card } from '@/components/ui/Card'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SelectField } from '@/components/ui/SelectField'
import { SeverityBadge } from '@/components/ui/SeverityBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Tabs } from '@/components/ui/Tabs'
import { useAlarmStore } from '@/context/AlarmStore'
import {
  ALARM_TYPE_LABELS,
  filterAlarms,
  type AlarmFilterState,
  type AlarmTab,
} from '@/lib/alarmFilters'
import { formatTimestamp } from '@/lib/format'
import { LOAD_DEFINITIONS } from '@/config/loads'
import type { AlarmSeverity, AlarmType, LoadFilter } from '@/types'

type UiStatus = 'ready' | 'loading' | 'error'

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
  const { alarms, openCount, clearedCount, acknowledge } = useAlarmStore()
  const [uiStatus, setUiStatus] = useState<UiStatus>('ready')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filters, setFilters] = useState<AlarmFilterState>({
    tab: 'active',
    severity: 'all',
    load: 'all',
    type: 'all',
  })

  const filtered = useMemo(
    () => filterAlarms(alarms, filters),
    [alarms, filters],
  )

  const selected = alarms.find((a) => a.id === selectedId) ?? null

  const simulateLoad = () => {
    setUiStatus('loading')
    window.setTimeout(() => setUiStatus('ready'), 600)
  }

  const handleAcknowledge = () => {
    if (!selected || selected.status !== 'active') return
    acknowledge(selected.id)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Alarms"
        description="Demo alarm list only. Thresholds and notification routing are TBD."
        actions={<StatusBadge state="DEMO" />}
      />

      <DataStateBanner
        state="DEMO"
        message="Acknowledgement updates local DEMO state only — it does not clear a real device alarm or write to a backend."
      />

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <Tabs
            value={filters.tab}
            onChange={(tab: AlarmTab) => setFilters((f) => ({ ...f, tab }))}
            items={[
              { id: 'active', label: 'Open', count: openCount },
              { id: 'historical', label: 'Historical', count: clearedCount },
            ]}
          />
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
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={simulateLoad}
            className="rounded-[8px] border border-border px-2.5 py-1 text-[11px] text-text-secondary hover:bg-surface"
          >
            Demo: loading state
          </button>
          <button
            type="button"
            onClick={() => setUiStatus('error')}
            className="rounded-[8px] border border-border px-2.5 py-1 text-[11px] text-text-secondary hover:bg-surface"
          >
            Demo: error state
          </button>
        </div>
      </Card>

      <Card padding="none">
        {uiStatus === 'loading' ? (
          <LoadingState label="Loading demo alarms…" className="m-4" />
        ) : null}

        {uiStatus === 'error' ? (
          <ErrorState
            className="m-4"
            title="Demo error state"
            description="Simulated failure for UI validation. No backend call was made."
            onRetry={() => setUiStatus('ready')}
          />
        ) : null}

        {uiStatus === 'ready' && filtered.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-8 w-8" />}
            title="No alarms match filters"
            description="Adjust severity, load, or type filters. Historical tab shows cleared demo events only."
            className="m-4"
          />
        ) : null}

        {uiStatus === 'ready' && filtered.length > 0 ? (
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
        ) : null}
      </Card>

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
