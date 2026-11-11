import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  acknowledgeAlarm,
  countCleared,
  countOpen,
  countUnacknowledged,
  filterOpenAlarms,
} from '@/lib/alarmFilters'
import type { AlarmItem } from '@/types'

interface AlarmStoreValue {
  alarms: AlarmItem[]
  openAlarms: AlarmItem[]
  openCount: number
  unacknowledgedCount: number
  clearedCount: number
  acknowledge: (alarmId: string) => void
}

const AlarmStoreContext = createContext<AlarmStoreValue | null>(null)

export function AlarmProvider({ children }: { children: ReactNode }) {
  const [alarms, setAlarms] = useState<AlarmItem[]>([])

  const acknowledge = useCallback((alarmId: string) => {
    setAlarms((prev) =>
      acknowledgeAlarm(
        prev,
        alarmId,
        'operator',
        new Date().toISOString(),
      ),
    )
  }, [])

  const value = useMemo<AlarmStoreValue>(() => {
    const openAlarms = filterOpenAlarms(alarms)
    return {
      alarms,
      openAlarms,
      openCount: countOpen(alarms),
      unacknowledgedCount: countUnacknowledged(alarms),
      clearedCount: countCleared(alarms),
      acknowledge,
    }
  }, [alarms, acknowledge])

  return (
    <AlarmStoreContext.Provider value={value}>
      {children}
    </AlarmStoreContext.Provider>
  )
}

export function useAlarmStore(): AlarmStoreValue {
  const ctx = useContext(AlarmStoreContext)
  if (!ctx) {
    throw new Error('useAlarmStore must be used within AlarmProvider')
  }
  return ctx
}
