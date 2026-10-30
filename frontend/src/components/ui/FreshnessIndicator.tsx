import { formatTimestamp, relativeAge } from '@/lib/format'
import { cn } from '@/lib/cn'

interface FreshnessIndicatorProps {
  asOf: string
  timeZone?: string
  className?: string
}

export function FreshnessIndicator({
  asOf,
  timeZone = 'Asia/Kolkata',
  className,
}: FreshnessIndicatorProps) {
  return (
    <p
      className={cn('text-[11px] text-text-secondary', className)}
      title={formatTimestamp(asOf, timeZone)}
    >
      As of {formatTimestamp(asOf, timeZone)} · {relativeAge(asOf)}
    </p>
  )
}
