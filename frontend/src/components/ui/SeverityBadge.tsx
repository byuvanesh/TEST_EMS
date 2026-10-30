import type { AlarmSeverity } from '@/types'
import { cn } from '@/lib/cn'

const STYLES: Record<AlarmSeverity, string> = {
  critical: 'bg-critical/10 text-critical border-critical/20',
  warning: 'bg-warning/10 text-warning-text border-warning/25',
  info: 'bg-accent/10 text-accent border-accent/20',
}

interface SeverityBadgeProps {
  severity: AlarmSeverity
  className?: string
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        STYLES[severity],
        className,
      )}
    >
      {severity}
    </span>
  )
}
