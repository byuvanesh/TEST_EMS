import { cn } from '@/lib/cn'

interface LoadingStateProps {
  label?: string
  className?: string
}

export function LoadingState({
  label = 'Loading…',
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-[12px] border border-border bg-surface px-6 py-12',
        className,
      )}
      role="status"
    >
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  )
}
