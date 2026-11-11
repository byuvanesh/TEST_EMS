import { useEffect, useState } from 'react'
import {
  Activity,
  Bell,
  CheckCircle2,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react'
import {
  apiClient,
  type ApiBridgeStatusResponse,
  type ApiSystemGatewayResponse,
} from '@/api/client'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Tabs } from '@/components/ui/Tabs'
import { useAlarmStore } from '@/context/AlarmStore'
import { formatTimestamp } from '@/lib/format'
import type { AlarmTab } from '@/lib/alarmFilters'
import type { DataQualityState } from '@/types'

export function AlarmsPage() {
  const { openCount, clearedCount } = useAlarmStore()

  // Real mode gateway & bridge status (reads from live endpoints)
  const [gateway, setGateway] = useState<ApiSystemGatewayResponse | null>(null)
  const [bridge, setBridge] = useState<ApiBridgeStatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [, setStatusError] = useState<string | null>(null)

  const [tab, setTab] = useState<AlarmTab>('active')

  useEffect(() => {
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
  }, [])

  const bridgeConnected = bridge?.status === 'connected' || bridge?.status === 'polling'
  const commDataState: DataQualityState = bridgeConnected ? 'LIVE' : 'NO_DATA'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alarms"
        description="Operational electrical alarms and telemetry alerts. Communication monitoring active."
        actions={<StatusBadge state={commDataState} />}
      />

      <DataStateBanner
        state={commDataState}
        message={
          bridgeConnected
            ? 'Gateway communication bridge active. Alarm evaluation requires valid telemetry samples from verified meter mappings.'
            : 'Alarm evaluation unavailable — gateway communication bridge is not connected. No alarms are fabricated or simulated.'
        }
      />

      {/* Gateway & Bridge Communication Health card */}
      <Card>
        <CardHeader
          title="Gateway & Communication Health"
          subtitle="GET /api/bridge/status & GET /api/system/gateway — communication monitoring only"
          action={<StatusBadge state={commDataState} compact />}
        />
        {statusLoading && !gateway && !bridge ? (
          <LoadingState label="Checking gateway communication…" className="p-4" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[6px] border border-border/70 bg-surface/50 p-3.5 transition-all hover:border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">Gateway Link</span>
                  <Radio className="h-4 w-4 text-text-secondary/70" />
                </div>
                <p className="mt-2 text-base font-semibold capitalize text-text">
                  {gateway?.gateway.status ?? 'unknown'}
                </p>
                <p className="mt-0.5 text-[11px] text-text-secondary">
                  {gateway?.gateway.name ?? 'Facility Gateway'}
                </p>
              </div>

              <div className="rounded-[6px] border border-border/70 bg-surface/50 p-3.5 transition-all hover:border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">Bridge Connection</span>
                  {bridgeConnected ? (
                    <Wifi className="h-4 w-4 text-success" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-text-secondary/70" />
                  )}
                </div>
                <p className="mt-2 text-base font-semibold capitalize text-text">
                  {bridge?.status ?? 'Disconnected'}
                </p>
                <p className="mt-0.5 text-[11px] text-text-secondary">
                  {bridge ? `Mode: ${bridge.mode}` : 'Bridge unavailable'}
                </p>
              </div>

              <div className="rounded-[6px] border border-border/70 bg-surface/50 p-3.5 transition-all hover:border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">Meters Reporting</span>
                  <Activity className="h-4 w-4 text-text-secondary/70" />
                </div>
                <p className="mt-2 text-base font-semibold text-text tabular-nums">
                  {gateway ? `${gateway.meters.filter((m) => m.status === 'online').length} / ${gateway.meters.length}` : '—'}
                </p>
                <p className="mt-0.5 text-[11px] text-text-secondary">
                  Gateway-level connectivity
                </p>
              </div>

              <div className="rounded-[6px] border border-border/70 bg-surface/50 p-3.5 transition-all hover:border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">Last Contact</span>
                  <CheckCircle2 className="h-4 w-4 text-text-secondary/70" />
                </div>
                <p className="mt-2 text-xs font-semibold text-text font-mono">
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

            <div className="rounded-[6px] bg-surface/60 border border-border/70 p-3.5 text-xs text-text-secondary leading-relaxed">
              <p>
                <strong className="font-semibold text-text">Hardware Telemetry & Alarms:</strong> Hardware communication status is reported directly from the local gateway bridge. Real electrical trip limits (overcurrent, undervoltage, power factor thresholds) require verified meter mappings and active telemetry samples.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Tabs */}
      <div className="p-4 sm:p-5">
        <Tabs
          value={tab}
          onChange={(newTab: AlarmTab) => setTab(newTab)}
          items={[
            { id: 'active', label: 'Open', count: openCount },
            { id: 'historical', label: 'Historical', count: clearedCount },
          ]}
        />
      </div>

      {/* Alarms Content / Empty State */}
      <Card padding="none">
        <EmptyState
          icon={<Bell className="h-8 w-8 text-text-secondary" />}
          title={
            tab === 'active'
              ? 'No active alarms'
              : 'No historical alarms'
          }
          description={
            commDataState === 'NO_DATA'
              ? 'Alarm evaluation unavailable — no valid telemetry input. Alarms will appear once live meter samples are received.'
              : 'Operational alarms are evaluated directly from live hardware telemetry. No simulated alarms are displayed.'
          }
        />
      </Card>
    </div>
  )
}
