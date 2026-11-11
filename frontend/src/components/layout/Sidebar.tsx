import { NavLink } from 'react-router-dom'
import {
  Activity,
  Bell,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Zap,
  Wifi,
} from 'lucide-react'
import { useBranding } from '@/context/BrandingContext'
import { cn } from '@/lib/cn'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/energy', label: 'Energy', icon: Zap },
  { to: '/alarms', label: 'Alarms', icon: Bell },
  { to: '/gateway', label: 'Gateway', icon: Wifi },
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
  const { companyName, logoUrl } = useBranding()

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
            'flex h-14 items-center border-b border-border px-3.5',
            collapsed ? 'justify-center' : 'justify-between gap-2',
          )}
        >
          <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName}
                className="h-8 w-8 rounded-[6px] object-contain bg-white shadow-xs p-0.5 border border-border/50 shrink-0"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-accent text-white shadow-xs">
                <Activity className="h-4 w-4" />
              </div>
            )}
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-text">
                  {companyName}
                </p>
                <p className="truncate text-[10px] font-medium text-text-secondary">
                  Energy Management
                </p>
              </div>
            ) : null}
          </div>
          {!collapsed ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden rounded-[6px] p-1.5 text-text-secondary hover:bg-surface hover:text-text md:inline-flex transition-colors"
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
              className="rounded-[6px] p-1.5 text-text-secondary hover:bg-surface hover:text-text transition-colors"
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
                  'flex items-center gap-2.5 rounded-[6px] px-3 py-2 text-xs font-medium transition-colors',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-accent/10 font-semibold text-accent'
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
              Monitoring only · Not a protection device · Electrical telemetry
            </p>
          ) : (
            <p className="text-center text-[10px] font-medium text-text-secondary">EMS</p>
          )}
        </div>
      </aside>
    </>
  )
}
