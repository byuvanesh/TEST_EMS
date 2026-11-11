import type { DataQualityState } from '@/types'
import { cn } from '@/lib/cn'

const STYLES: Record<DataQualityState, string> = {
  LIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  STALE: 'bg-rose-50 text-rose-700 border-rose-200/80',
  OFFLINE: 'bg-slate-100 text-slate-700 border-slate-200',
  DEMO: 'bg-amber-50 text-amber-800 border-amber-200/80',
  NO_DATA: 'bg-slate-50 text-slate-500 border-slate-200',
  UNKNOWN: 'bg-slate-100 text-slate-700 border-slate-200',
  UNVERIFIED: 'bg-amber-50 text-amber-800 border-amber-200/80',
}

interface StatusBadgeProps {
  state: DataQualityState
  className?: string
  compact?: boolean
}

export function StatusBadge({ state, className, compact }: StatusBadgeProps) {
  const label = state === 'DEMO' ? 'SIMULATED DATA' : state

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] border font-medium tracking-wide uppercase transition-colors',
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
