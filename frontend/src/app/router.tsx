import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  PublicOnly,
  RequireAuth,
} from '@/components/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { OverviewPage } from '@/pages/OverviewPage'
import { EnergyPage } from '@/pages/EnergyPage'
import { AlarmsPage } from '@/pages/AlarmsPage'
import { SystemPage } from '@/pages/SystemPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LoadDetailPage } from '@/pages/LoadDetailPage'
import { GatewayDetailsPage } from '@/pages/GatewayDetailsPage'
import { CustomMappingPage } from '@/pages/CustomMappingPage'
import { ParameterMappingPage } from '@/pages/ParameterMappingPage'
import { LoginPage } from '@/pages/LoginPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="login" element={<LoginPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="energy" element={<EnergyPage />} />
            <Route path="alarms" element={<AlarmsPage />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="gateway" element={<GatewayDetailsPage />} />
            <Route path="mapping" element={<CustomMappingPage />} />
            <Route path="parameter-mapping" element={<ParameterMappingPage />} />
            <Route path="loads/:loadId" element={<LoadDetailPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
