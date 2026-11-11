import { AppRouter } from '@/app/router'
import { AlarmProvider } from '@/context/AlarmStore'
import { AuthProvider } from '@/context/AuthContext'
import { BrandingProvider } from '@/context/BrandingContext'
import { DataSourceProvider } from '@/context/DataSourceContext'

export default function App() {
  return (
    <AuthProvider>
      <BrandingProvider>
        <DataSourceProvider initialSource="REAL">
          <AlarmProvider>
            <AppRouter />
          </AlarmProvider>
        </DataSourceProvider>
      </BrandingProvider>
    </AuthProvider>
  )
}
