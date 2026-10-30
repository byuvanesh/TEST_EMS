import { AppRouter } from '@/app/router'
import { AlarmProvider } from '@/context/AlarmStore'

export default function App() {
  return (
    <AlarmProvider>
      <AppRouter />
    </AlarmProvider>
  )
}
