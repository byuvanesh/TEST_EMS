import { Bell, Menu, Search } from 'lucide-react'
import type { DataQualityState } from '@/types'
import { formatTimestamp } from '@/lib/format'
import { StatusBadge } from '@/components/ui/StatusBadge'

interface HeaderProps {
  siteName: string
  timezoneLabel: string
  clockIso: string
  dataState: DataQualityState
  activeAlarmCount: number
  onMenuClick: () => void
}

export function Header({
  siteName,
  timezoneLabel,
  clockIso,
  dataState,
  activeAlarmCount,
  onMenuClick,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-sm md:px-6">
      <button
        type="button"
        className="inline-flex rounded-[8px] p-2 text-text-secondary hover:bg-surface md:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">{siteName}</p>
        <p className="truncate text-[11px] text-text-secondary">
          {formatTimestamp(clockIso)} · {timezoneLabel}
        </p>
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" />
          <input
            type="search"
            placeholder="Search loads, alarms…"
            disabled
            className="h-9 w-48 rounded-[8px] border border-border bg-surface pl-8 pr-3 text-xs text-text-secondary outline-none md:w-56"
            title="Search deferred — Phase 0 placeholder"
          />
        </div>
      </div>

      <StatusBadge state={dataState} />

      <button
        type="button"
        className="relative inline-flex rounded-[8px] p-2 text-text-secondary hover:bg-surface"
        aria-label={`${activeAlarmCount} open alarms`}
        title="Open alarms (active + acknowledged) — DEMO"
      >
        <Bell className="h-4 w-4" />
        {activeAlarmCount > 0 ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white">
            {activeAlarmCount}
          </span>
        ) : null}
      </button>
    </header>
  )
}
