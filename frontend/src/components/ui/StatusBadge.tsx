import type { DataQualityState } from '@/types'
import { cn } from '@/lib/cn'

const STYLES: Record<DataQualityState, string> = {
  LIVE: 'bg-success/10 text-success border-success/20',
  STALE: 'bg-warning/10 text-warning-text border-warning/25',
  OFFLINE: 'bg-critical/10 text-critical border-critical/20',
  DEMO: 'bg-surface text-text-secondary border-border',
}

interface StatusBadgeProps {
  state: DataQualityState
  className?: string
  compact?: boolean
}

export function StatusBadge({ state, className, compact }: StatusBadgeProps) {
  const label = state === 'DEMO' ? 'DEMO DATA' : state

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-medium tracking-wide uppercase',
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
        STYLES[state],
        className,
      )}
      title={`Data quality: ${label}`}
    >
      {label}
    </span>
  )
}
