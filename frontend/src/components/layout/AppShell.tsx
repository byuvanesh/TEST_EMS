import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Bell,
  LayoutDashboard,
  Settings2,
  Zap,
} from 'lucide-react'
import { useAlarmStore } from '@/context/AlarmStore'
import { buildOverviewData } from '@/mock/demoData'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { cn } from '@/lib/cn'

const MOBILE_TABS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/energy', label: 'Energy', icon: Zap },
  { to: '/alarms', label: 'Alarms', icon: Bell },
  { to: '/system', label: 'System', icon: Settings2 },
] as const

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { openAlarms, openCount } = useAlarmStore()
  const overview = buildOverviewData(openAlarms)

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200',
          collapsed ? 'md:pl-[72px]' : 'md:pl-[240px]',
        )}
      >
        <Header
          siteName={overview.site.name}
          timezoneLabel={overview.site.timezoneLabel}
          clockIso={overview.generatedAt}
          dataState={overview.globalDataState}
          activeAlarmCount={openCount}
          onMenuClick={() => setMobileOpen(true)}
        />

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 pb-20 md:px-6 md:pb-5">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-card md:hidden">
          {MOBILE_TABS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-medium',
                  isActive ? 'text-accent' : 'text-text-secondary',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
