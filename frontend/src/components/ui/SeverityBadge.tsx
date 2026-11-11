import type { AlarmSeverity } from '@/types'
import { cn } from '@/lib/cn'

const STYLES: Record<AlarmSeverity, string> = {
  critical: 'bg-rose-50 text-rose-700 border-rose-200/80',
  warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
  info: 'bg-blue-50 text-blue-700 border-blue-200/80',
}

interface SeverityBadgeProps {
  severity: AlarmSeverity
  className?: string
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        STYLES[severity],
        className,
      )}
    >
      {severity}
    </span>
  )
}
