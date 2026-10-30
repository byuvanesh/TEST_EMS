import { Info } from 'lucide-react'
import type { DataQualityState } from '@/types'
import { cn } from '@/lib/cn'

interface DataStateBannerProps {
  state: DataQualityState
  message?: string
}

export function DataStateBanner({ state, message }: DataStateBannerProps) {
  if (state !== 'DEMO' && state !== 'STALE' && state !== 'OFFLINE') {
    return null
  }

  const defaults: Record<'DEMO' | 'STALE' | 'OFFLINE', string> = {
    DEMO: 'All values on this screen are DEMO DATA for UI development. They are not live meter readings and must not be used for operational decisions.',
    STALE: 'One or more data sources are stale. Totals may under-report until freshness is restored.',
    OFFLINE: 'Telemetry is offline. Last known values may be shown as unavailable.',
  }

  const styles: Record<'DEMO' | 'STALE' | 'OFFLINE', string> = {
    DEMO: 'border-border bg-surface text-text',
    STALE: 'border-warning/30 bg-warning/10 text-warning-text',
    OFFLINE: 'border-critical/30 bg-critical/10 text-critical',
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
