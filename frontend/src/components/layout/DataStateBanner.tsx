import { Info } from 'lucide-react'
import type { DataQualityState } from '@/types'
import { cn } from '@/lib/cn'

interface DataStateBannerProps {
  state: DataQualityState
  message?: string
}

export function DataStateBanner({ state, message }: DataStateBannerProps) {
  if (state === 'LIVE') {
    return null
  }

  const defaults: Partial<Record<DataQualityState, string>> = {
    DEMO: 'All values on this screen are DEMO DATA for UI development. They are not live meter readings and must not be used for operational decisions.',
    STALE: 'One or more data sources are stale. Totals may under-report until freshness is restored.',
    OFFLINE: 'Telemetry is offline. Last known values may be shown as unavailable.',
    NO_DATA: 'No telemetry samples recorded yet. Waiting for live meter samples from the gateway.',
    UNVERIFIED: 'Meter mapping is unverified. Samples will remain unavailable until mapping is verified.',
    UNKNOWN: 'Operational data source active.',
  }

  const styles: Partial<Record<DataQualityState, string>> = {
    DEMO: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200',
    STALE: 'border-warning/30 bg-warning/10 text-warning-text',
    OFFLINE: 'border-critical/30 bg-critical/10 text-critical',
    NO_DATA: 'border-border bg-surface text-text-secondary',
    UNVERIFIED: 'border-warning/30 bg-warning/10 text-warning-text',
    UNKNOWN: 'border-border bg-surface text-text',
  }

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-[8px] border px-3 py-2.5 text-xs leading-relaxed',
        styles[state],
      )}
      role="status"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message ?? defaults[state]}</p>
    </div>
  )
}
