import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'
import { useAlarmStore } from '@/context/AlarmStore'
import { useAuth } from '@/context/AuthContext'
import { apiClient, type ApiOverviewResponse } from '@/api/client'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MobileBottomNav } from './MobileBottomNav'
import { cn } from '@/lib/cn'

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const { openCount } = useAlarmStore()
  const { mustChangePassword } = useAuth()

  const [realOverview, setRealOverview] = useState<ApiOverviewResponse | null>(null)

  useEffect(() => {
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
  }, [])

  const siteName = realOverview?.site?.name ?? 'Site 01 · Test Facility'
  const timezoneLabel = realOverview?.site?.timezone ?? 'Asia/Kolkata'
  const dataState = realOverview?.data_state ?? 'NO_DATA'
  const asOf = realOverview?.as_of ?? null

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
          clockIso={asOf ?? undefined}
          asOf={asOf}
          dataState={dataState}
          activeAlarmCount={(realOverview?.top_alarms as unknown[])?.length ?? openCount}
          loads={realOverview?.loads ?? []}
          onMenuClick={() => setMobileOpen(true)}
          changePasswordOpen={changePasswordOpen}
          onChangePasswordOpenChange={setChangePasswordOpen}
        />

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-3.5 py-4 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] sm:px-4 md:px-6 md:py-5 md:pb-5">
          <Outlet />
        </main>

        <MobileBottomNav />
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
