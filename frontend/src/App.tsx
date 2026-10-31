import { AppRouter } from '@/app/router'
import { AlarmProvider } from '@/context/AlarmStore'
import { DemoAuthProvider } from '@/context/DemoAuthStore'

export default function App() {
  return (
    <DemoAuthProvider>
      <AlarmProvider>
        <AppRouter />
      </AlarmProvider>
    </DemoAuthProvider>
  )
}
