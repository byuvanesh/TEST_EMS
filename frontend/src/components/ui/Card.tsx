import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md'
}

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
} as const

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[12px] border border-border bg-card',
        PADDING[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: CardHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div>
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
