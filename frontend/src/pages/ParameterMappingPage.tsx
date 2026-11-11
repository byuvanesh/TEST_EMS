import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  apiClient,
  type ApiMeter,
  type ApiSystemGatewayResponse,
  type ApiSystemMappingResponse,
} from '@/api/client'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { JsonMonitor } from '@/components/json-monitor/JsonMonitor'
import { ParameterButton } from '@/components/parameter-mapping/ParameterButton'
import { cn } from '@/lib/cn'

const PARAMETER_CATALOGUE = [
  { key: 'voltage_l1', label: 'Voltage L1', unit: 'V', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'voltage_l2', label: 'Voltage L2', unit: 'V', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'voltage_l3', label: 'Voltage L3', unit: 'V', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'current_l1', label: 'Current L1', unit: 'A', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'current_l2', label: 'Current L2', unit: 'A', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'current_l3', label: 'Current L3', unit: 'A', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'active_power_kw', label: 'Active Power', unit: 'kW', decode: 'float32', scale: 0.001, offset: 0.0 },
  { key: 'active_import_kwh', label: 'Energy Import', unit: 'kWh', decode: 'float32', scale: 0.01, offset: 0.0 },
  { key: 'reactive_power_kvar', label: 'Reactive Power', unit: 'kVAR', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'apparent_power_kva', label: 'Apparent Power', unit: 'kVA', decode: 'float32', scale: 1.0, offset: 0.0 },
  { key: 'power_factor', label: 'Power Factor', unit: 'PF', decode: 'float32', scale: 0.01, offset: 0.0 },
  { key: 'frequency_hz', label: 'Frequency', unit: 'Hz', decode: 'float32', scale: 1.0, offset: 0.0 },
] as const

export function ParameterMappingPage() {
  const [gateway, setGateway] = useState<ApiSystemGatewayResponse['gateway'] | null>(null)
  const [meters, setMeters] = useState<ApiMeter[]>([])
  const [mappings, setMappings] = useState<ApiSystemMappingResponse['meters']>([])
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null)
  const [selectedMeterId, setSelectedMeterId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGateway = useCallback(async () => {
    try {
      const [gwRes, mappingRes, payloadRes] = await Promise.all([
        apiClient.getSystemGateway(),
        apiClient.getSystemMapping(),
        apiClient.getGatewayLatestPayload(),
      ])
      setGateway(gwRes.gateway)
      const meters: ApiMeter[] = gwRes.meters.map((m) => ({
        id: m.meter_id,
        label: m.label,
        site_id: '',
        source_type: 'REAL',
        slave_id: m.slave_id,
        model: null,
        model_code: null,
        modbus_variant_verified: false,
        gateway: {
          id: gwRes.gateway.id,
          code: gwRes.gateway.code,
          mac: gwRes.gateway.mac ?? '',
        },
        mappings: [],
      }))
      setMeters(meters)
      setMappings(mappingRes.meters)
      setPayload(payloadRes.payload)
      if (gwRes.meters.length > 0 && !selectedMeterId) {
        setSelectedMeterId(gwRes.meters[0].meter_id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch gateway data')
    } finally {
      setLoading(false)
    }
  }, [selectedMeterId])

  useEffect(() => {
    fetchGateway()
  }, [fetchGateway])

  const selectedMeter = meters.find((m) => m.id === selectedMeterId)
  const selectedMeterMappings = selectedMeter?.mappings ?? []

  const rawKeys = payload
    ? Object.entries(payload)
        .filter(([k]) => /^s\d+_/.test(k))
        .map(([k, v]) => ({ key: k, value: v, type: typeof v }))
    : []

  const getMappingsForMeter = (meterId: string) => {
    return mappings.find((m) => m.id === meterId)?.mappings ?? []
  }

  const handleMappingConfirmed = () => {
    apiClient.getSystemMapping().then((res) => {
      setMappings(res.meters)
    })
  }

  if (loading && !meters.length) {
    return (
      <div className="rounded-[10px] border border-border bg-card p-8 text-center text-sm text-text-secondary">
        Loading parameter mapping configuration…
      </div>
    )
  }

  if (error) {
    return <DataStateBanner state="OFFLINE" message={error} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parameter Mapping"
        description="Configure Modbus register mappings for all four slaves. Map JSON source keys to engineering parameters with decoding, scaling, and verification."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchGateway}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-medium text-text hover:bg-surface"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
        }
      />

      {error && <DataStateBanner state="OFFLINE" message={error} />}

      <JsonMonitor
        gatewayMac={gateway?.mac ?? null}
        gatewayName={gateway?.name ?? null}
      />

      <Card className="rounded-[10px] border border-border bg-card shadow-sm">
        <CardHeader
          title="Select Slave Meter"
          subtitle={`Configure Modbus parameter mappings for ${meters.length} registered slave(s)`}
          className="pb-3"
        />
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {meters.map((meter) => {
              const meterMappings = getMappingsForMeter(meter.id)
              const verifiedCount = meterMappings.filter(
                (m) => m.verification_status === 'VERIFIED',
              ).length
              const isSelected = meter.id === selectedMeterId
              return (
                <button
                  key={meter.id}
                  onClick={() => setSelectedMeterId(meter.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-[8px] border p-3 text-left transition-colors',
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:bg-surface hover:border-text-secondary/50',
                  )}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          meter.slave_id === 1 ? '#DB2777' :
                          meter.slave_id === 2 ? '#3B82F6' :
                          meter.slave_id === 3 ? '#0D9488' : '#7C3AED',
                      }}
                    />
                    <span className="font-semibold text-text truncate">{meter.label}</span>
                  </div>
                  <p className="text-[10px] text-text-secondary">
                    Slave {meter.slave_id ?? '?'}
                  </p>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase mt-1',
                      verifiedCount === 12
                        ? 'border border-success/30 bg-success/10 text-success'
                        : verifiedCount > 0
                          ? 'border border-amber-500/30 bg-amber-500/10 text-amber-700'
                          : 'border border-border bg-surface text-text-secondary',
                    )}
                  >
                    {verifiedCount} / 12 Verified
                  </span>
                </button>
              )
            })}
            {meters.length === 0 && (
              <EmptyState
                title="No meters found"
                description="No meter records exist for this gateway. Meters must be commissioned first."
              />
            )}
          </div>
        </div>
      </Card>

      {selectedMeter && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-text">
                Parameter Mappings — {selectedMeter.label}
              </h2>
              <p className="text-[10px] text-text-secondary">
                Slave ID {selectedMeter.slave_id} · {selectedMeterMappings.length} of {PARAMETER_CATALOGUE.length} parameters mapped
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedMeter.mappings.length > 0 && (
                <button
                  type="button"
                  onClick={fetchGateway}
                  className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-medium text-text hover:bg-surface"
                >
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PARAMETER_CATALOGUE.map((param) => {
              const mapping = selectedMeterMappings.find(
                (m) => m.metric === param.key || m.source_keys.includes(param.key),
              )
              const existingMapping = mapping ? {
                source_keys: mapping.source_keys,
                decode: mapping.decode,
                word_order: mapping.word_order,
                byte_order: mapping.byte_order,
                scale: mapping.scale,
                offset: mapping.offset,
                unit: mapping.unit,
                verification_status: mapping.verification_status,
                verified_by: mapping.verified_by,
                verified_at: mapping.verified_at,
                evidence_note: mapping.evidence_note,
              } : null

              return (
                <ParameterButton
                  key={param.key}
                  slaveId={selectedMeter.slave_id ?? null}
                  meterId={selectedMeter.id}
                  meterLabel={selectedMeter.label}
                  parameterKey={param.key}
                  parameterLabel={param.label}
                  parameterUnit={param.unit}
                  existingMapping={existingMapping}
                  rawKeys={rawKeys}
                  onMappingConfirmed={handleMappingConfirmed}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

