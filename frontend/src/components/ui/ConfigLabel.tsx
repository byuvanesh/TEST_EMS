import type { ConfigCertainty } from '@/types'
import { cn } from '@/lib/cn'

const STYLES: Record<ConfigCertainty, string> = {
  CONFIRMED: 'bg-success/10 text-success border-success/20',
  PROPOSED: 'bg-accent/10 text-accent border-accent/20',
  TBD: 'bg-warning/10 text-warning-text border-warning/25',
  NOT_CONFIGURED: 'bg-surface text-text-secondary border-border',
  VERIFY: 'bg-critical/10 text-critical border-critical/20',
}

interface ConfigLabelProps {
  certainty: ConfigCertainty
  className?: string
}

export function ConfigLabel({ certainty, className }: ConfigLabelProps) {
  const text =
    certainty === 'NOT_CONFIGURED' ? 'NOT CONFIGURED' : certainty.replace('_', ' ')

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        STYLES[certainty],
        className,
      )}
    >
      {text}
    </span>
  )
}
