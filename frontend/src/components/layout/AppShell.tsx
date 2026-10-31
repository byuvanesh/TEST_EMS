import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Bell,
  LayoutDashboard,
  Settings2,
  Zap,
} from 'lucide-react'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'
import { useAlarmStore } from '@/context/AlarmStore'
import { useAuth } from '@/context/AuthContext'
import { useDataSource } from '@/context/DataSourceContext'
import { apiClient, type ApiOverviewResponse } from '@/api/client'
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
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const { openAlarms, openCount } = useAlarmStore()
  const { mustChangePassword } = useAuth()
  const { isDemo, isReal } = useDataSource()

  const [realOverview, setRealOverview] = useState<ApiOverviewResponse | null>(null)

  useEffect(() => {
    if (!isReal) return

    let cancelled = false
    async function fetchRealSiteInfo() {
      try {
        const res = await apiClient.getOverview('REAL')
        if (!cancelled) setRealOverview(res)
      } catch {
        if (!cancelled) setRealOverview(null)
      }
    }

    fetchRealSiteInfo()
    const timer = setInterval(fetchRealSiteInfo, 10000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [isReal])

  const demoOverview = buildOverviewData(openAlarms)

  const siteName = isReal
    ? realOverview?.site?.name ?? 'Site 01 · Test Facility'
    : demoOverview.site.name

  const timezoneLabel = isReal
    ? realOverview?.site?.timezone ?? 'Asia/Kolkata'
    : demoOverview.site.timezoneLabel

  const dataState = isReal
    ? realOverview?.data_state ?? 'NO_DATA'
    : demoOverview.globalDataState

  const asOf = isReal ? realOverview?.as_of ?? null : demoOverview.generatedAt

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
          siteName={siteName}
          timezoneLabel={timezoneLabel}
          clockIso={demoOverview.generatedAt}
          asOf={asOf}
          dataState={dataState}
          activeAlarmCount={isDemo ? openCount : 0}
          onMenuClick={() => setMobileOpen(true)}
          changePasswordOpen={changePasswordOpen}
          onChangePasswordOpenChange={setChangePasswordOpen}
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

      {/* Forced password change dialog if mustChangePassword is true */}
      {mustChangePassword ? (
        <ChangePasswordDialog
          open={true}
          forced={true}
          onSuccess={() => {}}
        />
      ) : null}
    </div>
  )
}
