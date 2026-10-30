import { NavLink } from 'react-router-dom'
import {
  Activity,
  Bell,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/energy', label: 'Energy', icon: Zap },
  { to: '/alarms', label: 'Alarms', icon: Bell },
  { to: '/system', label: 'System', icon: Settings2 },
] as const

interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapse: () => void
  onCloseMobile: () => void
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-text/20 md:hidden"
          aria-label="Close navigation"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card transition-[width,transform] duration-200',
          collapsed ? 'w-[72px]' : 'w-[240px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center border-b border-border px-3',
            collapsed ? 'justify-center' : 'justify-between gap-2',
          )}
        >
          <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-accent text-white">
              <Activity className="h-4 w-4" />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">TEST_EMS</p>
                <p className="truncate text-[10px] text-text-secondary">
                  Energy Management
                </p>
              </div>
            ) : null}
          </div>
          {!collapsed ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden rounded-[8px] p-1.5 text-text-secondary hover:bg-surface md:inline-flex"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {collapsed ? (
          <div className="hidden justify-center border-b border-border py-2 md:flex">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-[8px] p-1.5 text-text-secondary hover:bg-surface"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <nav className="flex flex-1 flex-col gap-1 p-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-surface hover:text-text',
                )
              }
              title={item.label}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          {!collapsed ? (
            <p className="text-[10px] leading-relaxed text-text-secondary">
              Monitoring only. Not a protection device. DEMO DATA — no live meters.
            </p>
          ) : (
            <p className="text-center text-[10px] text-text-secondary">P0</p>
          )}
        </div>
      </aside>
    </>
  )
}
