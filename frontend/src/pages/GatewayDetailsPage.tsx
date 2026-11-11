import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Database,
  RefreshCw,
  ShieldAlert,
  Wifi,
  WifiOff,
} from 'lucide-react'
import {
  apiClient,
  type ApiGatewayConnectionStatusResponse,
  type ApiGatewayHistoryItem,
  type ApiMappingItem,
  type ApiSystemGatewayResponse,
} from '@/api/client'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatNumber, formatTimestamp, formatTimeOnly, relativeAge } from '@/lib/format'
import { cn } from '@/lib/cn'
import { JsonMonitor } from '@/components/json-monitor/JsonMonitor'

// ---------------------------------------------------------------------------
// Constants — Four logical Modbus slave slots (never fabricated physical data)
// ---------------------------------------------------------------------------

const SLAVE_CONFIGURATION: ReadonlyArray<{
  readonly slaveId: number
  readonly meterName: string
}> = [
  { slaveId: 1, meterName: 'Compressor-01' },
  { slaveId: 2, meterName: 'AC-01' },
  { slaveId: 3, meterName: 'AC-02' },
  { slaveId: 4, meterName: 'AC-03' },
] as const

const PARAMETER_CATALOGUE: ReadonlyArray<{
  readonly index: number
  readonly parameter: string
  readonly unit: string
}> = [
  { index: 1, parameter: 'Voltage L1', unit: 'V' },
  { index: 2, parameter: 'Voltage L2', unit: 'V' },
  { index: 3, parameter: 'Voltage L3', unit: 'V' },
  { index: 4, parameter: 'Current L1', unit: 'A' },
  { index: 5, parameter: 'Current L2', unit: 'A' },
  { index: 6, parameter: 'Current L3', unit: 'A' },
  { index: 7, parameter: 'Active Power', unit: 'kW' },
  { index: 8, parameter: 'Energy', unit: 'kWh' },
  { index: 9, parameter: 'Reactive Power', unit: 'kVAR' },
  { index: 10, parameter: 'Apparent Power', unit: 'kVA' },
  { index: 11, parameter: 'Power Factor', unit: 'PF' },
  { index: 12, parameter: 'Frequency', unit: 'Hz' },
] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GatewayConnectionState =
  | 'NOT_CONNECTED'
  | 'ONLINE'
  | 'STALE'
  | 'OFFLINE'
  | 'CONNECTED_NO_DATA'
  | 'DATA_RECEIVING'
  | 'INGEST_ERROR'

type SlaveConfigState = 'CONFIGURED' | 'NOT CONFIGURED'
type SlaveCommState = 'COMMUNICATING' | 'NO DATA' | 'COMMUNICATION ERROR' | 'DECODE ERROR'
type SlaveTelemetryState = 'RECEIVING' | 'NO DATA' | 'STALE'

interface SlaveStatus {
  slaveId: number
  meterName: string
  configured: SlaveConfigState
  communication: SlaveCommState
  telemetry: SlaveTelemetryState
  lastPollTime: string | null
  lastTelemetryTime: string | null
  receivedKeys: number
  validMeasurements: number
  missingMeasurements: number
  lastError: string | null
}

interface DiagnosticItem {
  name: string
  status: 'PASS' | 'FAIL' | 'NOT TESTED' | 'NOT AVAILABLE'
  detail: string
}

interface ParameterValue {
  parameter: string
  unit: string
  value: string
  status: 'LIVE' | 'NO_DATA' | 'MAPPING_REQUIRED' | 'DECODE_ERROR'
  lastUpdated: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function connectionStateColor(state: GatewayConnectionState): string {
  switch (state) {
    case 'ONLINE':
    case 'DATA_RECEIVING':
      return 'text-success'
    case 'STALE':
    case 'CONNECTED_NO_DATA':
      return 'text-amber-500'
    case 'OFFLINE':
    case 'INGEST_ERROR':
      return 'text-error'
    case 'NOT_CONNECTED':
    default:
      return 'text-text-secondary'
  }
}

function connectionStateLabel(state: GatewayConnectionState): string {
  const labels: Record<GatewayConnectionState, string> = {
    NOT_CONNECTED: 'Not Connected',
    ONLINE: 'Online',
    STALE: 'Stale',
    OFFLINE: 'Offline',
    CONNECTED_NO_DATA: 'Connected (No Data)',
    DATA_RECEIVING: 'Data Receiving',
    INGEST_ERROR: 'Ingest Error',
  }
  return labels[state] ?? 'Unknown'
}

function connectionStateIcon(state: GatewayConnectionState) {
  switch (state) {
    case 'ONLINE':
    case 'DATA_RECEIVING':
      return <Wifi className="h-4 w-4 text-success" />
    case 'STALE':
    case 'CONNECTED_NO_DATA':
      return <Activity className="h-4 w-4 text-amber-500 animate-pulse" />
    case 'OFFLINE':
    case 'INGEST_ERROR':
      return <WifiOff className="h-4 w-4 text-error" />
    case 'NOT_CONNECTED':
    default:
      return <ShieldAlert className="h-4 w-4 text-text-secondary" />
  }
}

function firmwareDisplay(
  status: ApiGatewayConnectionStatusResponse['gateway'],
) {
  if (!status.firmware_version) {
    return (
      <span className="text-text-secondary">Not reported</span>
    )
  }
  return (
    <>
      <span className="font-medium text-text">{status.firmware_version}</span>
      {status.last_heartbeat_at ? (
        <span className="ml-1 text-[10px] text-text-secondary">
          · Last reported {relativeAge(status.last_heartbeat_at)}
        </span>
      ) : null}
    </>
  )
}

function extractSlaveKeys(
  payload: Record<string, unknown> | null,
): Map<number, string[]> {
  const slaveKeys = new Map<number, string[]>()
  if (!payload) return slaveKeys
  for (const k of Object.keys(payload).sort()) {
    const m = k.match(/^s(\d+)_/)
    if (m) {
      const slaveId = parseInt(m[1], 10)
      if (!slaveKeys.has(slaveId)) slaveKeys.set(slaveId, [])
      slaveKeys.get(slaveId)!.push(k)
    }
  }
  return slaveKeys
}

function getParameterValue(
  parameter: string,
  unit: string,
  mapping: ApiMappingItem | null | undefined,
  payload: Record<string, unknown> | null,
): ParameterValue {
  // No mapping → Mapping Required
  if (!mapping) {
    return {
      parameter,
      unit,
      value: '—',
      status: 'MAPPING_REQUIRED',
      lastUpdated: null,
    }
  }

  // Mapping exists but source key not in payload → No Data
  const sourceKey = mapping.source_keys?.[0]
  if (!sourceKey || !payload || !(sourceKey in payload)) {
    return {
      parameter,
      unit,
      value: '—',
      status: 'NO_DATA',
      lastUpdated: null,
    }
  }

  const rawValue = payload[sourceKey]
  if (rawValue === null || rawValue === undefined) {
    return {
      parameter,
      unit,
      value: '—',
      status: 'NO_DATA',
      lastUpdated: null,
    }
  }

  // Suspicious values (e.g. 2.35e-41) → treat as invalid, not a measurement
  if (typeof rawValue === 'number' && (!Number.isFinite(rawValue) || Math.abs(rawValue) < 1e-30)) {
    return {
      parameter,
      unit,
      value: '—',
      status: 'DECODE_ERROR',
      lastUpdated: null,
    }
  }

  return {
    parameter,
    unit,
    value: typeof rawValue === 'number' ? formatNumber(rawValue, 2) : String(rawValue),
    status: 'LIVE',
    lastUpdated: null,
  }
}

// ---------------------------------------------------------------------------
// GatewayStatusCard (existing, preserved)
// ---------------------------------------------------------------------------

interface GatewayStatusCardProps {
  status: ApiGatewayConnectionStatusResponse['gateway']
}

export function GatewayStatusCard({ status }: GatewayStatusCardProps) {
  const state = status.connection_state as GatewayConnectionState

  return (
    <Card className="rounded-[10px] border border-border bg-card shadow-sm">
      <CardHeader
        title="Gateway Connection"
        subtitle={`MAC: ${status.mac ?? '—'} · Source: ${status.source_type}`}
        action={
          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
            {connectionStateIcon(state)}
            <span className={cn('font-semibold capitalize', connectionStateColor(state))}>
              {connectionStateLabel(state)}
            </span>
          </span>
        }
        className="mb-4"
      />

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Firmware
        </span>
        {firmwareDisplay(status)}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Last Heartbeat
          </p>
          <p className="mt-1 tabular text-[11px] font-medium text-text">
            {status.last_heartbeat_at
              ? `${formatTimestamp(status.last_heartbeat_at)} · ${relativeAge(status.last_heartbeat_at)}`
              : 'Never (heartbeat tracking unavailable — migration 012 not applied)'}
          </p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Last Telemetry
          </p>
          <p className="mt-1 tabular text-[11px] font-medium text-text">
            {status.last_telemetry_at
              ? `${formatTimestamp(status.last_telemetry_at)} · ${relativeAge(status.last_telemetry_at)}`
              : 'Never'}
          </p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Connection Duration
          </p>
          <p className="mt-1 tabular text-[11px] font-medium text-text">
            {status.connection_duration_seconds !== null
              ? `${Math.floor(status.connection_duration_seconds / 60)}m ${status.connection_duration_seconds % 60}s`
              : '—'}
          </p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Source Type
          </p>
          <p className="mt-1 tabular text-[11px] font-medium text-text">
            {status.source_type}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Total Heartbeats
          </p>
          <p className="mt-1 tabular text-[11px] font-semibold text-text">
            {status.totals.heartbeats}
            {status.migration_required && <span className="ml-1 text-[10px] text-text-secondary/70">(n/a)</span>}
          </p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Telemetry Uploads
          </p>
          <p className="mt-1 tabular text-[11px] font-semibold text-text">
            {status.totals.telemetry_uploads}
          </p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Ingest Errors
          </p>
          <p className="mt-1 tabular text-[11px] font-semibold text-text-error">
            {status.totals.ingest_errors}
          </p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Auth Errors
          </p>
          <p className="mt-1 tabular text-[11px] font-semibold text-text-error">
            {status.totals.auth_errors}
          </p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Validation Errors
          </p>
          <p className="mt-1 tabular text-[11px] font-semibold text-text-error">
            {status.totals.validation_errors}
          </p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Last Ingest Error
          </p>
          <p className="mt-1 tabular text-[10px] font-medium text-text-error truncate">
            {status.last_ingest_error_message ?? '—'}
          </p>
        </div>
      </div>

      {status.last_ingest_error_message && (
        <div className="mt-4 rounded-[8px] border border-critical/30 bg-critical/10 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-critical shrink-0" />
            <p className="text-[11px] text-critical leading-relaxed">
              <span className="font-semibold">Last error at:</span>{' '}
              {status.last_ingest_error_at
                ? formatTimestamp(status.last_ingest_error_at)
                : 'unknown'}{' '}
              <span className="font-semibold">Reason:</span>{' '}
              {status.last_ingest_error_message}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// SlaveStatusCard — Section B: Per-slave status card
// ---------------------------------------------------------------------------

interface SlaveStatusCardProps {
  slave: SlaveStatus
}

export function SlaveStatusCard({ slave }: SlaveStatusCardProps) {
  const commColor =
    slave.communication === 'COMMUNICATING'
      ? 'text-success'
      : slave.communication === 'NO DATA'
        ? 'text-text-secondary'
        : 'text-error'

  const configColor =
    slave.configured === 'CONFIGURED' ? 'text-success' : 'text-text-secondary'

  return (
    <Card className="rounded-[10px] border border-border bg-card shadow-sm">
      <CardHeader
        title={`${slave.meterName} — Slave ${slave.slaveId}`}
        subtitle={`Configuration: ${slave.configured}`}
        action={
          <span className="flex items-center gap-1.5 text-xs">
            <span className={cn('font-semibold', commColor)}>
              {slave.communication}
            </span>
          </span>
        }
        className="mb-3"
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Configuration
          </p>
          <p className="mt-1 tabular text-[11px] font-semibold text-text">
            <span className={cn(configColor)}>{slave.configured}</span>
          </p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Communication
          </p>
          <p className="mt-1 tabular text-[11px] font-semibold text-text">
            <span className={cn(commColor)}>{slave.communication}</span>
          </p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Telemetry
          </p>
          <p className="mt-1 tabular text-[11px] font-semibold text-text">
            {slave.telemetry}
          </p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Received Keys
          </p>
          <p className="mt-1 tabular text-[11px] font-semibold text-text">
            {slave.receivedKeys}
          </p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Valid Measurements
          </p>
          <p className="mt-1 tabular text-[11px] font-semibold text-text">
            {slave.validMeasurements}
          </p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Missing Measurements
          </p>
          <p className="mt-1 tabular text-[11px] font-semibold text-text">
            {slave.missingMeasurements}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Last Poll
          </p>
          <p className="mt-1 tabular text-[11px] font-medium text-text">
            {slave.lastPollTime ? `${formatTimeOnly(slave.lastPollTime)}` : '—'}
          </p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-surface/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Last Telemetry
          </p>
          <p className="mt-1 tabular text-[11px] font-medium text-text">
            {slave.lastTelemetryTime ? `${formatTimeOnly(slave.lastTelemetryTime)}` : '—'}
          </p>
        </div>
      </div>

      {slave.lastError && (
        <div className="mt-3 rounded-[8px] border border-critical/30 bg-critical/10 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-critical shrink-0" />
            <p className="text-[11px] text-critical leading-relaxed">
              <span className="font-semibold">Last error:</span> {slave.lastError}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// SlaveParameterTable — Section C: 12-parameter table per slave
// ---------------------------------------------------------------------------

interface SlaveParameterTableProps {
  slaveId: number
  meterName: string
  mappings: ApiMappingItem[]
  payload: Record<string, unknown> | null
}

export function SlaveParameterTable({
  slaveId,
  meterName,
  mappings,
  payload,
}: SlaveParameterTableProps) {
  // Build a lookup: metric → mapping for this meter
  // We match mappings by checking if any source_key starts with s{slaveId}_
  const slaveMappings = useMemo(() => {
    const map = new Map<string, ApiMappingItem>()
    for (const m of mappings) {
      for (const key of m.source_keys) {
        const match = key.match(/^s(\d+)_/)
        if (match && parseInt(match[1], 10) === slaveId) {
          map.set(m.metric, m)
          break
        }
      }
    }
    return map
  }, [mappings, slaveId])

  const slaveKeys = extractSlaveKeys(payload)
  const keysForThisSlave = slaveKeys.get(slaveId) ?? []

  const parameterRows = PARAMETER_CATALOGUE.map((param) => {
    // Try to find a mapping for this parameter
    // We match by metric name similarity or by source key prefix
    const mapping = slaveMappings.get(param.parameter)
    const value = getParameterValue(param.parameter, param.unit, mapping, payload)

    return {
      index: param.index,
      parameter: param.parameter,
      unit: param.unit,
      value: value.value,
      status: value.status,
      lastUpdated: value.lastUpdated,
    }
  })

  const liveCount = parameterRows.filter((r) => r.status === 'LIVE').length
  const mappingRequiredCount = parameterRows.filter(
    (r) => r.status === 'MAPPING_REQUIRED',
  ).length

  return (
    <Card className="rounded-[10px] border border-border bg-card shadow-sm overflow-hidden">
      <CardHeader
        title={`${meterName} — Slave ${slaveId} Parameters`}
        subtitle={
          `${liveCount} of 12 parameters live${
            mappingRequiredCount > 0
              ? ` · ${mappingRequiredCount} mapping(s) required`
              : ''
          }`
        }
        className="pb-3"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface/75 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
            <tr className="border-b border-border">
              <th className="py-2 px-4">#</th>
              <th className="py-2 px-4">Parameter</th>
              <th className="py-2 px-4">Unit</th>
              <th className="py-2 px-4">Value</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4">Mapping</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {parameterRows.map((row) => {
              const statusColor =
                row.status === 'LIVE'
                  ? 'text-emerald-700 border-emerald-100 bg-emerald-50/60'
                  : row.status === 'MAPPING_REQUIRED'
                    ? 'text-amber-700 border-amber-100 bg-amber-50/60'
                    : row.status === 'DECODE_ERROR'
                      ? 'text-error border-critical/30 bg-critical/10'
                      : 'text-text-secondary border-border/60 bg-surface/50'

              const mappingStatus = row.status === 'MAPPING_REQUIRED' ? 'Mapping Required' : 'Mapped'

              return (
                <tr key={row.index} className="hover:bg-surface/50 transition-colors">
                  <td className="py-2 px-4 font-mono text-[10px] text-text-secondary">
                    {row.index}
                  </td>
                  <td className="py-2 px-4 font-medium text-text">{row.parameter}</td>
                  <td className="py-2 px-4 font-mono text-[10px] text-text-secondary">
                    {row.unit}
                  </td>
                  <td className="py-2 px-4 font-mono text-text truncate max-w-[120px]">
                    {row.value}
                  </td>
                  <td className="py-2 px-4">
                    <span className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-semibold uppercase',
                      statusColor,
                    )}>
                      {row.status === 'LIVE' ? 'Live' : row.status === 'NO_DATA' ? 'No Data' : row.status === 'MAPPING_REQUIRED' ? 'Mapping Required' : 'Decode Error'}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-[10px] text-text-secondary">
                    {mappingStatus}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {keysForThisSlave.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <p className="text-[10px] text-text-secondary">
            Raw keys discovered for Slave {slaveId}:{' '}
            <span className="font-mono text-text">{keysForThisSlave.join(', ')}</span>
          </p>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// DiagnosticSummary — Section F: Diagnostic status
// ---------------------------------------------------------------------------

interface DiagnosticSummaryProps {
  diagnostics: DiagnosticItem[]
}

export function DiagnosticSummary({ diagnostics }: DiagnosticSummaryProps) {
  const statusColor: Record<DiagnosticItem['status'], string> = {
    PASS: 'text-emerald-700 border-emerald-100 bg-emerald-50/60',
    FAIL: 'text-error border-critical/30 bg-critical/10',
    'NOT TESTED': 'text-amber-700 border-amber-100 bg-amber-50/60',
    'NOT AVAILABLE': 'text-text-secondary border-border/60 bg-surface/50',
  }

  return (
    <Card className="rounded-[10px] border border-border bg-card shadow-sm overflow-hidden">
      <CardHeader
        title="Gateway Diagnostics"
        subtitle="System health checks — PASS / FAIL / NOT TESTED / NOT AVAILABLE"
        className="pb-3"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface/75 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
            <tr className="border-b border-border">
              <th className="py-2 px-4">Diagnostic</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {diagnostics.map((d) => (
              <tr key={d.name} className="hover:bg-surface/50 transition-colors">
                <td className="py-2 px-4 font-medium text-text">{d.name}</td>
                <td className="py-2 px-4">
                  <span className={cn(
                    'inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-semibold uppercase',
                    statusColor[d.status],
                  )}>
                    {d.status}
                  </span>
                </td>
                <td className="py-2 px-4 text-[10px] text-text-secondary truncate max-w-[260px]">
                  {d.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// GatewayHistoryTable (existing, preserved)
// ---------------------------------------------------------------------------

interface GatewayHistoryTableProps {
  history: ApiGatewayHistoryItem[]
  migrationRequired?: boolean
  migrationMessage?: string | null
}

export function GatewayHistoryTable({
  history,
  migrationRequired,
  migrationMessage,
}: GatewayHistoryTableProps) {
  if (migrationRequired) {
    return (
      <div className="rounded-[8px] border border-amber-500/30 bg-amber-50/10 p-4">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              History tracking unavailable
            </p>
            <p className="mt-0.5 text-xs text-amber-700 leading-relaxed">
              {migrationMessage ?? 'Database migration 012 has not been applied.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-border/80 bg-surface/30 p-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-text-secondary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-text">
              No communication history
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              Gateway communication events will appear here as they occur.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className="rounded-[10px] border border-border bg-card shadow-sm overflow-hidden">
      <CardHeader
        title="Communication History"
        subtitle="Heartbeat, telemetry, polling, authentication, validation, and ingest events"
        className="mb-0"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface/75 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
            <tr className="border-b border-border">
              <th className="py-2.5 px-4">Time</th>
              <th className="py-2.5 px-4">Event Type</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">Source</th>
              <th className="py-2.5 px-4">Error Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {history.map((event) => (
              <tr key={event.id} className="transition-colors hover:bg-surface/50">
                <td className="py-2.5 px-4 font-mono text-[10px] text-text-secondary whitespace-nowrap">
                  {formatTimestamp(event.received_at)}
                </td>
                <td className="py-2.5 px-4 font-mono text-[10px] text-text">
                  {event.event_type}
                </td>
                <td className="py-2.5 px-4 text-[10px]">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase',
                      event.status === 'success' || event.status === 'ok'
                        ? 'border border-success/30 bg-success/10 text-success'
                        : event.status === 'error' || event.status === 'failed'
                          ? 'border border-critical/30 bg-critical/10 text-critical'
                          : 'border border-border bg-surface text-text-secondary',
                    )}
                  >
                    {event.status ?? '—'}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-[10px] text-text-secondary">
                  {event.source_type}
                </td>
                <td className="py-2.5 px-4 text-[10px] text-text-secondary truncate max-w-[200px]">
                  {event.error_message ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function GatewayDetailsPage() {
  const [status, setStatus] = useState<ApiGatewayConnectionStatusResponse['gateway'] | null>(null)
  const [systemGateway, setSystemGateway] = useState<ApiSystemGatewayResponse | null>(null)
  const [mappings, setMappings] = useState<ApiMappingItem[]>([])
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null)
  const [payloadMeta, setPayloadMeta] = useState<{ receivedAt: string | null; decodeStatus: string | null } | null>(null)
  const [history, setHistory] = useState<ApiGatewayHistoryItem[]>([])
  const [migrationRequired, setMigrationRequired] = useState<boolean>(false)
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchAllData() {
    try {
      setError(null)
      const [statusRes, systemRes, mappingRes, , historyRes] =
        await Promise.all([
          apiClient.getGatewayStatus(),
          apiClient.getSystemGateway(),
          apiClient.getSystemMapping(),
          (async () => {
            const res = await apiClient.getGatewayLatestPayload()
            if (res.hasPayload && res.payload) {
              setPayload(res.payload)
              setPayloadMeta({
                receivedAt: res.receivedAt ?? null,
                decodeStatus: res.decodeStatus ?? null,
              })
            } else {
              setPayload(null)
              setPayloadMeta(null)
            }
          })(),
          apiClient.getGatewayHistory({ limit: 50 }),
        ])

      setStatus(statusRes.gateway)
      setSystemGateway(systemRes)
      setMappings(mappingRes.meters.flatMap((m) => m.mappings))
      setHistory(historyRes.history)
      setMigrationRequired(historyRes.migration_required ?? false)
      setMigrationMessage(historyRes.migration_message ?? null)
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch gateway data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAllData()
    const interval = setInterval(fetchAllData, 10000)
    return () => clearInterval(interval)
  }, [])

  // ---------------------------------------------------------------------------
  // Derived data: Build per-slave status from API responses + raw payload
  // ---------------------------------------------------------------------------

  const slaveKeys = useMemo(() => extractSlaveKeys(payload), [payload])
  const payloadReceivedAt = payloadMeta?.receivedAt

  const slaveStatuses: SlaveStatus[] = useMemo(() => {
    const meterBySlaveId = new Map<number, ApiSystemGatewayResponse['meters'][number]>()
    if (systemGateway) {
      for (const m of systemGateway.meters) {
        if (m.slave_id !== null) {
          meterBySlaveId.set(m.slave_id, m)
        }
      }
    }

    const results: SlaveStatus[] = []

    for (const { slaveId, meterName } of SLAVE_CONFIGURATION) {
      const meter = meterBySlaveId.get(slaveId)
      const configured: SlaveConfigState = meter ? 'CONFIGURED' : 'NOT CONFIGURED'

      const keysForSlave = slaveKeys.get(slaveId) ?? []
      const receivedKeys = keysForSlave.length

      // Count mappings for this slave's parameters
      let validMeasurements = 0
      let missingMeasurements = 0
      for (const param of PARAMETER_CATALOGUE) {
        const mapping = [...mappings].find((m) =>
          m.source_keys.some((k) => {
            const match = k.match(/^s(\d+)_/)
            return match && parseInt(match[1], 10) === slaveId && m.metric === param.parameter
          }),
        )
        if (mapping) {
          const sourceKey = mapping.source_keys[0]
          if (sourceKey && payload && sourceKey in payload && payload[sourceKey] !== null) {
            validMeasurements++
          } else {
            missingMeasurements++
          }
        } else {
          missingMeasurements++
        }
      }

      let communication: SlaveCommState = 'NO DATA'
      let telemetry: SlaveTelemetryState = 'NO DATA'
      let lastError: string | null = null

      if (configured === 'NOT CONFIGURED') {
        communication = 'NO DATA'
        telemetry = 'NO DATA'
      } else if (receivedKeys > 0) {
        communication = 'COMMUNICATING'
        telemetry = 'RECEIVING'
      } else {
        communication = 'NO DATA'
        telemetry = 'NO DATA'
      }

      results.push({
        slaveId,
        meterName,
        configured,
        communication,
        telemetry,
        lastPollTime: payloadReceivedAt ?? null,
        lastTelemetryTime: payloadReceivedAt ?? null,
        receivedKeys,
        validMeasurements,
        missingMeasurements,
        lastError,
      })
    }

    return results
  }, [systemGateway, mappings, payload, slaveKeys, payloadReceivedAt])

  // ---------------------------------------------------------------------------
  // Diagnostics
  // ---------------------------------------------------------------------------

  const diagnostics: DiagnosticItem[] = useMemo(() => {
    const gwMac = status?.mac ?? systemGateway?.gateway.mac ?? null
    const hasGateway = Boolean(gwMac)
    const hasRawPayload = Boolean(payload)
    const hasMappings = mappings.length > 0
    const migrationNotRequired = !migrationRequired

    const gwConnectionState = status?.connection_state as GatewayConnectionState | undefined

    return [
      {
        name: 'Gateway Communication',
        status: hasGateway && gwConnectionState !== 'NOT_CONNECTED' ? 'PASS' : 'FAIL',
        detail: gwConnectionState ?? 'No gateway record found',
      },
      {
        name: 'Heartbeat API',
        status: migrationNotRequired ? 'PASS' : 'NOT AVAILABLE',
        detail: migrationNotRequired
          ? 'Heartbeat tracking columns available'
          : 'Migration 012 not applied — heartbeat timestamps unavailable',
      },
      {
        name: 'Telemetry Ingestion',
        status: hasRawPayload ? 'PASS' : 'NOT TESTED',
        detail: hasRawPayload
          ? `Raw payload received (${payloadMeta?.receivedAt ?? 'unknown'})`
          : 'No raw payloads in database',
      },
      {
        name: 'Payload Decoding',
        status: hasRawPayload && hasMappings ? 'PASS' : 'NOT TESTED',
        detail: hasMappings
          ? 'Metric mappings exist for decoding'
          : 'No metric mappings — decoder cannot produce measurements',
      },
      {
        name: 'Meter Mapping',
        status: hasMappings ? 'PASS' : 'FAIL',
        detail: hasMappings
          ? `${mappings.length} mapping(s) configured`
          : 'Zero metric mappings for production meters',
      },
      {
        name: 'Per-Slave Polling',
        status: hasRawPayload ? 'PASS' : 'NOT TESTED',
        detail: hasRawPayload
          ? `${slaveKeys.size} slave(s) discovered in latest payload`
          : 'No slave data available',
      },
      {
        name: 'Database Persistence',
        status: hasRawPayload ? 'PASS' : 'NOT TESTED',
        detail: hasRawPayload
          ? 'raw_payloads and telemetry_samples tables writable'
          : 'No persistence activity detected',
      },
    ]
  }, [status, systemGateway, payload, mappings, migrationRequired, slaveKeys, payloadMeta])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const state = status?.connection_state as GatewayConnectionState | undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gateway Monitoring"
        description="Four-slave Modbus gateway monitoring: Compressor-01, AC-01, AC-02, AC-03"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchAllData}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-medium text-text hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            {status ? (
              <StatusBadge
                state={
                  state === 'ONLINE' ||
                  state === 'DATA_RECEIVING' ||
                  state === 'STALE' ||
                  state === 'CONNECTED_NO_DATA'
                    ? 'LIVE'
                    : state === 'NOT_CONNECTED'
                      ? 'NO_DATA'
                      : 'UNKNOWN'
                }
                compact
              />
            ) : null}
          </div>
        }
      />

      {error && (
        <DataStateBanner state="OFFLINE" message={`Gateway monitoring error: ${error}`} />
      )}

      {loading && !status ? (
        <div className="rounded-[10px] border border-border bg-card p-8 text-center text-sm text-text-secondary">
          Loading gateway monitoring data…
        </div>
      ) : (
        <>
          {/* Section A: Gateway Overview */}
          {status && <GatewayStatusCard status={status} />}

          {/* Section B: Slave Status Summary */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-text-secondary" />
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider">
                Slave Status Summary
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {slaveStatuses.map((s) => (
                <SlaveStatusCard key={s.slaveId} slave={s} />
              ))}
            </div>
          </section>

          {/* Section C: Slave Parameter Details */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-text-secondary" />
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider">
                Slave Parameter Details
              </h2>
              <p className="ml-2 text-xs text-text-secondary">
                12 parameters per slave · {PARAMETER_CATALOGUE.length} slots each
              </p>
            </div>
            <div className="space-y-4">
              {slaveStatuses.map((s) => {
                return (
                  <SlaveParameterTable
                    key={s.slaveId}
                    slaveId={s.slaveId}
                    meterName={s.meterName}
                    mappings={mappings}
                    payload={payload}
                  />
                )
              })}
            </div>
          </section>

          {/* Section D: Gateway JSON Monitor */}
          {status && (
            <JsonMonitor
              gatewayMac={status.mac ?? null}
              gatewayName={status.name ?? null}
            />
          )}

          {/* Section E: Communication History */}
          <GatewayHistoryTable
            history={history}
            migrationRequired={migrationRequired}
            migrationMessage={migrationMessage}
          />

          {migrationRequired && (
            <div className="rounded-[8px] border border-amber-500/30 bg-amber-50/10 p-4">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Database migration pending
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700 leading-relaxed">
                    {migrationMessage ?? 'Migration 012 (gateway_communication_history) has not been applied. History tracking and heartbeat timestamps are not available.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section F: Diagnostics */}
          <DiagnosticSummary diagnostics={diagnostics} />
        </>
      )}
    </div>
  )
}

export { SLAVE_CONFIGURATION, PARAMETER_CATALOGUE }
export type { SlaveStatus, DiagnosticItem, ParameterValue }
