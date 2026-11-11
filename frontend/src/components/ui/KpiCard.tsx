import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { KpiSnapshot } from '@/types'
import { formatNumber, formatPowerFactor } from '@/lib/format'
import { Card } from './Card'
import { FreshnessIndicator } from './FreshnessIndicator'
import { StatusBadge } from './StatusBadge'
import { cn } from '@/lib/cn'

interface KpiCardProps {
  kpi: KpiSnapshot
  to?: string
  showBadge?: boolean
  className?: string
  hero?: boolean
  compact?: boolean
  mobileLabel?: string
  mobileNote?: string
}

export function KpiCard({
  kpi,
  to,
  showBadge = false,
  className,
  hero = false,
  compact = false,
  mobileLabel,
  mobileNote,
}: KpiCardProps) {
  const display =
    kpi.value === null
      ? '—'
      : kpi.id === 'aggregate-pf'
        ? formatPowerFactor(kpi.value)
        : kpi.id === 'active-alarms' || kpi.id === 'loads-reporting'
          ? formatNumber(kpi.value, 0)
          : formatNumber(kpi.value, 1)

  const content = (
    <Card
      className={cn(
        'group relative flex flex-col justify-between rounded-[10px] border border-border/80 bg-card shadow-2xs transition-all',
        compact ? 'p-2.5 sm:p-3.5 min-h-[82px] sm:min-h-[108px]' : hero ? 'p-3.5 sm:p-4 min-h-[110px] sm:min-h-[126px]' : 'p-3.5 sm:p-4 min-h-[100px] sm:min-h-[118px]',
        to && 'hover:border-border hover:shadow-xs active:scale-[0.98] cursor-pointer',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1 min-w-0">
        <span className="truncate text-xs font-medium text-text-secondary">
          {mobileLabel ? (
            <>
              <span className="sm:hidden">{mobileLabel}</span>
              <span className="hidden sm:inline">{kpi.label}</span>
            </>
          ) : (
            kpi.label
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {showBadge && <StatusBadge state={kpi.dataState} compact />}
          {to ? (
            <ArrowUpRight className="h-3 w-3 text-text-secondary/50 transition-colors group-hover:text-accent" />
          ) : null}
        </div>
      </div>

      <div className={cn(compact ? 'mt-1 sm:mt-2' : 'mt-2 sm:mt-2.5')}>
        <p
          className={cn(
            'tabular font-bold tracking-tight text-text leading-none flex items-baseline',
            hero
              ? 'text-[26px] sm:text-[32px]'
              : compact
                ? 'text-[20px] sm:text-[24px]'
                : 'text-[22px] sm:text-[26px]',
          )}
        >
          <span>{display}</span>
          {kpi.unit && kpi.value !== null ? (
            <span className="ml-1 text-[11px] sm:text-xs font-medium text-text-secondary">
              {kpi.unit}
            </span>
          ) : null}
        </p>

        {kpi.note ? (
          <p className="mt-1 text-[10px] sm:text-[11px] leading-tight text-text-secondary truncate">
            {mobileNote ? (
              <>
                <span className="sm:hidden">{mobileNote}</span>
                <span className="hidden sm:inline">{kpi.note}</span>
              </>
            ) : (
              kpi.note
            )}
          </p>
        ) : null}
      </div>

      {!compact ? (
        <FreshnessIndicator asOf={kpi.asOf} className="mt-2 text-[10px] text-text-secondary/70" />
      ) : null}
    </Card>
  )

  if (to) {
    return (
      <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[10px]">
        {content}
      </Link>
    )
  }

  return content
}
