import { formatTimestamp, relativeAge } from '@/lib/format'
import { cn } from '@/lib/cn'

interface FreshnessIndicatorProps {
  asOf?: string | null
  timeZone?: string
  className?: string
}

export function FreshnessIndicator({
  asOf,
  timeZone = 'Asia/Kolkata',
  className,
}: FreshnessIndicatorProps) {
  if (!asOf) {
    return (
      <p className={cn('text-[11px] text-text-secondary', className)}>
        No telemetry yet
      </p>
    )
  }

  return (
    <p
      className={cn('text-[11px] text-text-secondary', className)}
      title={formatTimestamp(asOf, timeZone)}
    >
      As of {formatTimestamp(asOf, timeZone)} · {relativeAge(asOf)}
    </p>
  )
}
