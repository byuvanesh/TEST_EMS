import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ErrorStateProps {
  title?: string
  description: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[12px] border border-critical/20 bg-critical/5 px-6 py-12 text-center',
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="mb-3 h-8 w-8 text-critical" />
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-text-secondary">
        {description}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-[8px] bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}
