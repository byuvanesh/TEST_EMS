import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

interface DeltaBadgeProps {
  value: number | null
  className?: string
}

export function DeltaBadge({ value, className }: DeltaBadgeProps) {
  if (value === null) {
    return (
      <span className={cn('text-xs text-text-secondary', className)}>—</span>
    )
  }

  const positive = value > 0
  const negative = value < 0

  return (
    <span
      className={cn(
        'tabular text-xs font-medium',
        positive && 'text-critical',
        negative && 'text-success',
        !positive && !negative && 'text-text-secondary',
        className,
      )}
    >
      {positive ? '+' : ''}
      {formatNumber(value, 1)}%
    </span>
  )
}
