import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  title: string
  description: string
  icon?: ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[12px] border border-dashed border-border bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="mb-3 text-text-secondary">{icon}</div> : null}
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-text-secondary">
        {description}
      </p>
    </div>
  )
}
