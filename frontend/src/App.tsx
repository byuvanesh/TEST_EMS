import { AppRouter } from '@/app/router'
import { AlarmProvider } from '@/context/AlarmStore'
import { AuthProvider } from '@/context/AuthContext'
import { DataSourceProvider } from '@/context/DataSourceContext'

export default function App() {
  return (
    <AuthProvider>
      <DataSourceProvider initialSource="REAL">
        <AlarmProvider>
          <AppRouter />
        </AlarmProvider>
      </DataSourceProvider>
    </AuthProvider>
  )
}
