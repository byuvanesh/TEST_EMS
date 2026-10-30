import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { OverviewPage } from '@/pages/OverviewPage'
import { EnergyPage } from '@/pages/EnergyPage'
import { AlarmsPage } from '@/pages/AlarmsPage'
import { SystemPage } from '@/pages/SystemPage'
import { LoadDetailPage } from '@/pages/LoadDetailPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="energy" element={<EnergyPage />} />
          <Route path="alarms" element={<AlarmsPage />} />
          <Route path="system" element={<SystemPage />} />
          <Route path="loads/:loadId" element={<LoadDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
