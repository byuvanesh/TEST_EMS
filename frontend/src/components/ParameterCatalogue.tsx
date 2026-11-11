import { Card, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'

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

interface ParameterCatalogueProps {
  mappings: MappingItem[]
  slaveId: number | null
  loadId: string
}

export function ParameterCatalogue({
  mappings,
  slaveId,
  loadId,
}: ParameterCatalogueProps) {
  const mappingBySourceKey = new Map<string, MappingItem>()
  for (const m of mappings) {
    for (const key of m.source_keys) {
      mappingBySourceKey.set(key, m)
    }
  }

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader
        title={`Parameter Mappings — ${loadId}`}
        subtitle={`Slave ID: ${slaveId ?? 'Not assigned'} · 12 parameters`}
        className="pb-3"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PARAMETER_CATALOGUE.map((param) => {
          const mapping = mappings.find(
            (m) => m.source_keys.includes(param.key) && m.metric === param.key,
          )
          const sourceKey = mapping?.source_keys[0] ?? null
          const isMapped = !!mapping
          const isVerified = mapping?.verification_status === 'VERIFIED'

          return (
            <div
              key={param.key}
              className="rounded-[8px] border border-border bg-card p-2.5 sm:p-3 shadow-xs"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-text">
                  {param.label}
                </span>
                <span className="text-[10px] font-mono text-text-secondary">
                  {param.key}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div className="rounded-[6px] border border-border bg-surface/40 p-1.5 text-[10px]">
                  <span className="text-text-secondary">Source key</span>
                  <div className="mt-0.5 font-mono text-xs text-text">
                    {sourceKey}
                  </div>
                </div>
                <div className="rounded-[6px] border border-border bg-surface/40 p-1.5 text-[10px]">
                  <span className="text-text-secondary">Status</span>
                  <div className="mt-0.5">
                    <StatusBadge
                      state={
                        isMapped
                          ? (isVerified ? 'LIVE' : 'UNVERIFIED')
                          : 'UNKNOWN'
                      }
                      compact
                    />
                    <span className="text-[10px] text-text-secondary">
                      {isMapped ? mapping.verification_status : 'Mapping Pending'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-text-secondary">
                <span>Scale ×{param.scale}</span>
                <span className="text-text-secondary/70">Offset {param.offset}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-text-secondary">
                <span>Decode</span>
                <span>{param.decode}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-text-secondary">
                <span>Unit</span>
                <span>{param.unit}</span>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}