import { NavLink } from 'react-router-dom'
import {
  Bell,
  LayoutDashboard,
  Settings2,
  Sliders,
  Zap,
  Wifi,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAlarmStore } from '@/context/AlarmStore'
import { useDataSource } from '@/context/DataSourceContext'
import { cn } from '@/lib/cn'

export interface NavItemConfig {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export function MobileBottomNav() {
  const { user } = useAuth()
  const { openCount } = useAlarmStore()
  const { isDemo } = useDataSource()

  // Real alarm count when in simulated mode, or when state is active
  const alarmCount = isDemo ? openCount : 0

  // 4 primary destinations for viewers, 5 for admins (including Settings)
  const navItems: NavItemConfig[] = [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/energy', label: 'Energy', icon: Zap },
    { to: '/alarms', label: 'Alarms', icon: Bell },
    { to: '/gateway', label: 'Gateway', icon: Wifi },
    { to: '/system', label: 'System', icon: Settings2 },
    ...(user?.role === 'admin'
      ? [{ to: '/settings', label: 'Settings', icon: Sliders }]
      : []),
  ]

  return (
    <nav
      role="navigation"
      aria-label="Mobile bottom navigation"
      className="fixed left-[calc(0.75rem+env(safe-area-inset-left,0px))] right-[calc(0.75rem+env(safe-area-inset-right,0px))] bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-30 mx-auto max-w-[420px] rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.12),0_2px_8px_rgba(15,23,42,0.06)] md:hidden"
    >
      <div className="flex h-[62px] w-full items-center justify-around px-1.5 py-1">
        {navItems.map((item) => {
          const isAlarms = item.to === '/alarms'
          const showBadge = isAlarms && alarmCount > 0

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? false}
              className={({ isActive }) =>
                cn(
                  'group relative flex min-h-[48px] flex-1 flex-col items-center justify-center rounded-xl px-1 py-1 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                  isActive
                    ? 'bg-blue-50/90 text-accent font-semibold'
                    : 'text-slate-500 hover:text-slate-800 font-medium',
                )
              }
              aria-label={
                showBadge
                  ? `${item.label}, ${alarmCount} active alarms`
                  : item.label
              }
            >
              {({ isActive }) => (
                <>
                  {/* Icon with real badge */}
                  <div className="relative flex items-center justify-center">
                    <item.icon
                      aria-hidden="true"
                      className={cn(
                        'h-5 w-5 shrink-0 transition-transform duration-150 group-active:scale-90',
                        isActive
                          ? 'text-accent stroke-[2.2]'
                          : 'text-slate-500 stroke-[1.8] group-hover:text-slate-800',
                      )}
                    />

                    {/* Real active alarm badge */}
                    {showBadge ? (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1.5 -right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-critical px-1 text-[9px] font-bold text-white shadow-xs ring-2 ring-white"
                      >
                        {alarmCount > 99 ? '99+' : alarmCount}
                      </span>
                    ) : null}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      'mt-1 truncate text-[10px] tracking-tight leading-none transition-colors',
                      isActive ? 'text-accent' : 'text-slate-500 group-hover:text-slate-800',
                    )}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
