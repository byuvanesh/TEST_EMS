import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-3 sm:mb-5', className)}>
      {breadcrumbs ? <div className="mb-1">{breadcrumbs}</div> : null}
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold sm:font-semibold tracking-tight text-text truncate">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 text-xs text-text-secondary leading-normal hidden sm:block">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  )
}
