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
    <div className={cn('mb-6', className)}>
      {breadcrumbs ? <div className="mb-2">{breadcrumbs}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-text-secondary">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
    </div>
  )
}
