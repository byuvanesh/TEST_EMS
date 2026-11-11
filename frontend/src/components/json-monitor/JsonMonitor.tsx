import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Code,
  RefreshCw,
  Copy,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { apiClient } from '@/api/client'
import { Card, CardHeader } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

interface JsonMonitorProps {
  gatewayMac: string | null
  gatewayName: string | null
}

type SlaveFilter = 'all' | 1 | 2 | 3 | 4

type ValueType = 'number' | 'string' | 'null' | 'boolean' | 'object' | 'array' | 'invalid'

function getValueType(v: unknown): ValueType {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'object') return 'object'
  if (typeof v === 'number') return 'number'
  if (typeof v === 'string') return 'string'
  if (typeof v === 'boolean') return 'boolean'
  return 'invalid'
}

function valueTypeColor(t: ValueType): string {
  switch (t) {
    case 'number': return 'text-green-600'
    case 'string': return 'text-blue-600'
    case 'boolean': return 'text-purple-600'
    case 'null': return 'text-amber-500'
    case 'object': return 'text-indigo-600'
    case 'array': return 'text-indigo-600'
    case 'invalid': return 'text-red-600'
    default: return 'text-text-secondary'
  }
}

export function JsonMonitor({ gatewayMac, gatewayName }: JsonMonitorProps) {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null)
  const [payloadMeta, setPayloadMeta] = useState<{
    payloadId: number | null
    receivedAt: string | null
    decodeStatus: string | null
    mappingVersion: number | null
    localServerTs: number | null
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawView, setRawView] = useState(false)
  const [slaveFilter, setSlaveFilter] = useState<SlaveFilter>('all')

  const fetchPayload = useCallback(async () => {
    if (!gatewayMac) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.getGatewayLatestPayload()
      if (res.hasPayload && res.payload) {
        setPayload(res.payload)
        setPayloadMeta({
          payloadId: res.payloadId,
          receivedAt: res.receivedAt,
          decodeStatus: res.decodeStatus,
          mappingVersion: res.mappingVersion,
          localServerTs: res.localServerTs,
        })
      } else {
        setPayload(null)
        setPayloadMeta(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch gateway payload')
    } finally {
      setLoading(false)
    }
  }, [gatewayMac])

  useEffect(() => {
    fetchPayload()
  }, [fetchPayload])

  const keys = payload ? Object.keys(payload).sort() : []
  const allSlaveKeys = useMemo(() => {
    const map = new Map<number, string[]>()
    if (payload) {
      for (const k of keys) {
        const m = k.match(/^s(\d+)_/)
        if (m) {
          const slaveId = parseInt(m[1], 10)
          if (!map.has(slaveId)) map.set(slaveId, [])
          map.get(slaveId)!.push(k)
        }
      }
    }
    return map
  }, [payload, keys])

  const slaveFilterLabels: Record<SlaveFilter, string> = {
    all: 'All Slaves',
    1: 'Slave 1',
    2: 'Slave 2',
    3: 'Slave 3',
    4: 'Slave 4',
  }

  const filteredKeys = useMemo(() => {
    if (slaveFilter === 'all') return keys
    return keys.filter((k) => {
      const m = k.match(/^s(\d+)_/)
      return m && parseInt(m[1], 10) === slaveFilter
    })
  }, [keys, slaveFilter])

  const filteredSlaveCount = useMemo(() => {
    if (slaveFilter === 'all') return allSlaveKeys.size
    return allSlaveKeys.has(slaveFilter) ? 1 : 0
  }, [allSlaveKeys, slaveFilter])

  const handleCopy = () => {
    if (!payload) return
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
  }

  const formattedJson = payload ? JSON.stringify(payload, null, 2) : ''
  const rawJson = payload ? JSON.stringify(payload) : ''

  return (
    <Card className="rounded-[10px] border border-border bg-card shadow-sm">
      <CardHeader
        title="Gateway JSON Monitor"
        subtitle={`${gatewayName ?? 'Gateway'} · Live raw payload from ${gatewayMac ?? '—'}`}
        className="pb-3"
        action={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={fetchPayload}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-[6px] border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-text hover:bg-surface disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Refresh
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!payload || loading}
              className="inline-flex items-center gap-1 rounded-[6px] border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-text hover:bg-surface disabled:opacity-50"
            >
              <Copy className="h-3 w-3" /> Copy JSON
            </button>
            <button
              type="button"
              onClick={() => setRawView(!rawView)}
              className="inline-flex items-center gap-1 rounded-[6px] border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-text hover:bg-surface"
            >
              {rawView ? (
                <>
                  <ChevronRight className="h-3 w-3" /> Formatted
                </>
              ) : (
                <>
                  <Code className="h-3 w-3" /> Raw
                </>
              )}
            </button>
          </div>
        }
      />

      {error && (
        <div className="p-3 text-[11px] text-error bg-critical/10 border border-critical/30 rounded-[6px]">
          {error}
        </div>
      )}

      {!payload ? (
        <div className="p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-text-secondary" />
          <p className="mt-3 text-sm font-medium text-text">No raw payload available</p>
          <p className="mt-1 text-xs text-text-secondary">
            The gateway has not uploaded any telemetry payloads yet. Once the
            gateway connects and uploads data, the raw JSON will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="px-4 py-3 border-b border-border">
            <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
              <span>
                Payload ID:{' '}
                <span className="font-mono text-text">{payloadMeta?.payloadId ?? '—'}</span>
              </span>
              <span>
                Received:{' '}
                <span className="font-mono text-text">
                  {payloadMeta?.receivedAt ?? '—'}
                </span>
              </span>
              <span>
                Decode:{' '}
                <span className="font-mono text-text">{payloadMeta?.decodeStatus ?? '—'}</span>
              </span>
              <span>
                Mapping v:{' '}
                <span className="font-mono text-text">{payloadMeta?.mappingVersion ?? '—'}</span>
              </span>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              Discovered Slaves ({filteredSlaveCount})
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <div className="rounded-[6px] border border-border bg-surface/50 px-2.5 py-1.5">
                <span className="text-[10px] font-medium text-text">Filter:</span>{' '}
                <div className="mt-1 flex gap-1">
                  {Object.entries(slaveFilterLabels).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSlaveFilter(value as SlaveFilter)}
                      className={cn(
                        'rounded-[4px] border px-2 py-0.5 text-[9px] font-medium',
                        slaveFilter === value as SlaveFilter
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border/60 text-text-secondary hover:bg-surface/50',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {[...allSlaveKeys.entries()].map(([slaveId, keys]) => (
                <div key={slaveId} className="rounded-[6px] border border-border bg-surface/50 px-2.5 py-1.5">
                  <span className="text-[10px] font-medium text-text">Slave {slaveId}</span>
                  <span className="ml-1 text-[10px] font-mono text-text-secondary">
                    ({keys.length} keys)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="relative">
              <pre className={`font-mono text-[10px] overflow-x-auto whitespace-pre break-all ${rawView ? 'h-64' : 'h-48'}`}>
                {rawView ? rawJson : formattedJson}
              </pre>
            </div>
          </div>

          <div className="px-4 py-3 border-t border-border">
            <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              Key-Value Details ({filteredKeys.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px]">
                <thead>
                  <tr>
                    <th className="pb-1.5 px-2 font-medium text-text-secondary">Key</th>
                    <th className="pb-1.5 px-2 font-medium text-text-secondary">Type</th>
                    <th className="pb-1.5 px-2 font-medium text-text-secondary">Value</th>
                    <th className="pb-1.5 px-2 font-medium text-text-secondary">Slave</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredKeys.map((k) => {
                    const v = payload[k]
                    const type = getValueType(v)
                    const slaveMatch = k.match(/^s(\d+)_/)
                    const slaveId = slaveMatch ? slaveMatch[1] : '—'
                    return (
                      <tr key={k} className="hover:bg-surface/50">
                        <td className="py-1.5 px-2 font-mono text-text truncate max-w-[120px]">{k}</td>
                        <td className="py-1.5 px-2 font-mono">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${valueTypeColor(type)}`}>
                            {type}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 font-mono text-text truncate max-w-[200px]">
                          {v === null ? 'null' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-text-secondary">{slaveId}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}