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
    DEMO: 'All values on this screen are SIMULATED DATA. They are not live meter readings and must not be used for operational decisions.',
    STALE: 'One or more data sources are stale. Totals may under-report until freshness is restored.',
    OFFLINE: 'Telemetry is offline. Last known values may be shown as unavailable.',
    NO_DATA: 'No telemetry samples recorded yet. Waiting for live meter samples from the gateway.',
    UNVERIFIED: 'Meter mapping is unverified. Samples will remain unavailable until mapping is verified.',
    UNKNOWN: 'Operational data source active.',
  }

  const styles: Partial<Record<DataQualityState, string>> = {
    DEMO: 'border-amber-200 bg-amber-50 text-amber-900',
    STALE: 'border-rose-200 bg-rose-50 text-rose-800',
    OFFLINE: 'border-slate-300 bg-slate-100 text-slate-800',
    NO_DATA: 'border-slate-200 bg-slate-50 text-slate-600',
    UNVERIFIED: 'border-amber-200 bg-amber-50 text-amber-900',
    UNKNOWN: 'border-border bg-surface text-text',
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-[6px] border px-3 py-2 text-[11px] sm:text-xs leading-normal transition-colors shadow-2xs',
        styles[state],
      )}
      role="status"
    >
      <Info className="h-3.5 w-3.5 shrink-0" />
      <p className="line-clamp-2 sm:line-clamp-none">{message ?? defaults[state]}</p>
    </div>
  )
}
