import { describe, expect, it } from 'vitest'
import {
  acknowledgeAlarm,
  countCleared,
  countOpen,
  countUnacknowledged,
  filterAlarms,
  filterOpenAlarms,
} from '@/lib/alarmFilters'
import { createDemoAlarms } from '@/mock/alarmsDemoData'

describe('filterAlarms', () => {
  const alarms = createDemoAlarms()

  it('returns active and acknowledged on active/open tab', () => {
    const result = filterAlarms(alarms, {
      tab: 'active',
      severity: 'all',
      load: 'all',
      type: 'all',
    })
    expect(result.every((a) => a.status !== 'cleared')).toBe(true)
    expect(result.length).toBe(3)
  })

  it('returns only cleared on historical tab', () => {
    const result = filterAlarms(alarms, {
      tab: 'historical',
      severity: 'all',
      load: 'all',
      type: 'all',
    })
    expect(result.every((a) => a.status === 'cleared')).toBe(true)
    expect(result.length).toBe(3)
  })

  it('filters by severity and load', () => {
    const result = filterAlarms(alarms, {
      tab: 'active',
      severity: 'warning',
      load: 'AC-03',
      type: 'all',
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('alm-demo-001')
  })

  it('filters by alarm type', () => {
    const result = filterAlarms(alarms, {
      tab: 'historical',
      severity: 'all',
      load: 'all',
      type: 'communication',
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('alm-demo-006')
  })
})

describe('open alarm counts', () => {
  it('countOpen includes active and acknowledged only', () => {
    const alarms = createDemoAlarms()
    expect(countOpen(alarms)).toBe(3)
    expect(countUnacknowledged(alarms)).toBe(2)
    expect(countCleared(alarms)).toBe(3)
    expect(filterOpenAlarms(alarms).some((a) => a.status === 'cleared')).toBe(
      false,
    )
  })
})

describe('acknowledgeAlarm', () => {
  it('updates only the targeted active alarm in local state', () => {
    const alarms = createDemoAlarms()
    const next = acknowledgeAlarm(
      alarms,
      'alm-demo-001',
      'simulated.operator',
      '2026-10-30T12:00:00+05:30',
    )

    const target = next.find((a) => a.id === 'alm-demo-001')
    expect(target?.status).toBe('acknowledged')
    expect(target?.acknowledgedBy).toBe('simulated.operator')
    expect(target?.acknowledgedAt).toBe('2026-10-30T12:00:00+05:30')
    expect(target?.dataState).toBe('DEMO')

    const untouched = next.find((a) => a.id === 'alm-demo-002')
    expect(untouched?.status).toBe('active')
  })

  it('does not re-acknowledge already acknowledged alarms', () => {
    const alarms = createDemoAlarms()
    const next = acknowledgeAlarm(
      alarms,
      'alm-demo-003',
      'someone.else',
      '2026-10-30T13:00:00+05:30',
    )
    const target = next.find((a) => a.id === 'alm-demo-003')
    expect(target?.acknowledgedBy).toBe('simulated.operator')
  })
})
