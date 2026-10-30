import type {
  AlarmItem,
  AlarmSeverity,
  AlarmStatus,
  AlarmType,
  LoadFilter,
} from '@/types'

export type AlarmTab = 'active' | 'historical'

export interface AlarmFilterState {
  tab: AlarmTab
  severity: AlarmSeverity | 'all'
  load: LoadFilter
  type: AlarmType | 'all'
}

/** Open = raised and not cleared (active + acknowledged). */
export function isOpenAlarmStatus(status: AlarmStatus): boolean {
  return status === 'active' || status === 'acknowledged'
}

export function isActiveTabStatus(status: AlarmStatus): boolean {
  return isOpenAlarmStatus(status)
}

export function isHistoricalTabStatus(status: AlarmStatus): boolean {
  return status === 'cleared'
}

export function filterOpenAlarms(alarms: AlarmItem[]): AlarmItem[] {
  return alarms.filter((a) => isOpenAlarmStatus(a.status))
}

export function countOpen(alarms: AlarmItem[]): number {
  return filterOpenAlarms(alarms).length
}

/** Unacknowledged open = status active only. */
export function countUnacknowledged(alarms: AlarmItem[]): number {
  return alarms.filter((a) => a.status === 'active').length
}

export function countAcknowledgedOpen(alarms: AlarmItem[]): number {
  return alarms.filter((a) => a.status === 'acknowledged').length
}

export function countCleared(alarms: AlarmItem[]): number {
  return alarms.filter((a) => a.status === 'cleared').length
}

export function filterAlarms(
  alarms: AlarmItem[],
  filters: AlarmFilterState,
): AlarmItem[] {
  return alarms.filter((alarm) => {
    if (filters.tab === 'active' && !isActiveTabStatus(alarm.status)) return false
    if (filters.tab === 'historical' && !isHistoricalTabStatus(alarm.status)) {
      return false
    }
    if (filters.severity !== 'all' && alarm.severity !== filters.severity) return false
    if (filters.type !== 'all' && alarm.type !== filters.type) return false
    if (filters.load !== 'all' && alarm.loadId !== filters.load) return false
    return true
  })
}

export function acknowledgeAlarm(
  alarms: AlarmItem[],
  alarmId: string,
  acknowledgedBy: string,
  atIso: string,
): AlarmItem[] {
  return alarms.map((alarm) => {
    if (alarm.id !== alarmId) return alarm
    if (alarm.status !== 'active') return alarm
    return {
      ...alarm,
      status: 'acknowledged',
      acknowledgedAt: atIso,
      acknowledgedBy,
    }
  })
}

export const ALARM_TYPE_LABELS: Record<AlarmType, string> = {
  overcurrent: 'Overcurrent',
  undervoltage: 'Undervoltage',
  power_factor: 'Power factor',
  communication: 'Communication',
  frequency: 'Frequency',
  other: 'Other',
}
