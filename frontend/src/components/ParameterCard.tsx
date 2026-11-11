import { Card, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatNumber, formatTimestamp } from '@/lib/format'

/**
 * ParameterCard: Shows a single parameter with its mapping status,
 * source key, and decoded value (if available).
 *
 * Data source: backend /api/system/mapping and /api/loads/:id
 * Source isolation: All reads use source_type='REAL' only.
 */

interface ParameterCardProps {
  parameter: {
    key: string
    label: string
    unit: string
    decode: string
    scale: number
    offset: number
  }
  mapping: {
    sourceKey: string | null
    status: 'VERIFIED' | 'UNVERIFIED' | 'NOT_CONFIGURED'
    verifiedAt: string | null
  }
  value: number | null
  asOf: string | null
}

export function ParameterCard({
  parameter,
  mapping,
  value,
  asOf,
}: ParameterCardProps) {
  const { sourceKey } = mapping
  const isMapped = !!sourceKey
  const isVerified = mapping.status === 'VERIFIED'
  const hasValue = value !== null && value !== undefined

  // Determine display value
  let displayValue: string
  if (!isMapped) {
    displayValue = '—'
  } else if (!hasValue) {
    displayValue = '—'
  } else {
    // Apply scale and offset for display
    if (parameter.decode === 'float32' || parameter.decode === 'number') {
      displayValue = formatNumber(parameter.scale * value + parameter.offset, 2)
    } else {
      displayValue = formatNumber(value, 1)
    }
  }

  return (
    <Card className="rounded-[8px] border border-border bg-card shadow-sm">
      <CardHeader
        title={parameter.label}
        subtitle={`${parameter.key} · ${parameter.unit}`}
        className="pb-3"
      />
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-[6px] border border-border bg-surface/40 p-1.5">
          <span className="text-[10px] font-medium text-text-secondary">Source key</span>
          <div className="mt-0.5 font-mono text-[9px] text-text-secondary truncate">
            {sourceKey ?? '—'}
          </div>
        </div>
        <div className="rounded-[6px] border border-border bg-surface/40 p-1.5 text-[10px]">
          <span className="text-text-secondary">Mapping</span>
          <StatusBadge
            state={
              isMapped
                ? (isVerified ? 'LIVE' : 'UNVERIFIED')
                : 'UNKNOWN'
            }
            compact
          />
          <span className="text-[10px] text-text-secondary mt-1 block">
            {isMapped ? mapping.status : 'Mapping Pending'}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-text-secondary mt-2">
        <span>Scale ×{parameter.scale}</span>
        <span>{parameter.unit}</span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="font-medium text-text">{displayValue}</span>
        <span className="text-text-secondary">{parameter.unit}</span>
      </div>
      <div className="mt-2 text-[10px] text-text-secondary">
        Last heard: {asOf ? formatTimestamp(asOf) : 'Never'}
      </div>
    </Card>
  )
}