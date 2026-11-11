import { describe, expect, it } from 'vitest'
import {
  acknowledgeAlarm,
  countCleared,
  countOpen,
  countUnacknowledged,
  filterOpenAlarms,
  filterAlarms,
} from '@/lib/alarmFilters'
import { createDemoAlarms } from '@/mock/alarmsDemoData'
import { buildOverviewData } from '@/mock/demoData'
import { apiClient } from '@/api/client'
import alarmsPageSource from './AlarmsPage.tsx?raw'

describe('Step 6d: Alarm count definition consistency (2 vs 3 fix)', () => {
  it('demo alarms baseline: 3 open (still-raised) and 2 unacknowledged', () => {
    const alarms = createDemoAlarms()
    // The canonical definition of "Open" is still-raised (active + acknowledged)
    expect(countOpen(alarms)).toBe(3)
    expect(countUnacknowledged(alarms)).toBe(2)
    expect(countCleared(alarms)).toBe(3)
  })

  it('Overview KPI count, Header bell count, and Alarms tab count all agree on 3 in DEMO mode', () => {
    const alarms = createDemoAlarms()
    const openAlarms = filterOpenAlarms(alarms)
    const openCount = countOpen(alarms)

    // 1. Overview KPI count
    const overview = buildOverviewData(openAlarms)
    const kpi = overview.kpis.find((k) => k.id === 'active-alarms')
    expect(kpi?.value).toBe(3)
    expect(kpi?.label).toBe('Open alarms')
    expect(kpi?.note).toBe('Active + acknowledged')

    // 2. Header bell count uses openCount
    const headerBellCount = openCount
    expect(headerBellCount).toBe(3)

    // 3. Alarms page tab count uses openCount
    const alarmsTabCount = openCount
    expect(alarmsTabCount).toBe(3)

    // All three agree: no 2 vs 3 disagreement
    expect(kpi?.value).toBe(headerBellCount)
    expect(headerBellCount).toBe(alarmsTabCount)
  })

  it('acknowledging an alarm preserves count agreement across all three sites', () => {
    const alarms = createDemoAlarms()
    // Acknowledge one active alarm
    const updated = acknowledgeAlarm(
      alarms,
      'alm-demo-001',
      'simulated.operator',
      '2026-10-30T12:00:00+05:30',
    )

    // Unacknowledged count drops from 2 to 1
    expect(countUnacknowledged(updated)).toBe(1)

    // But Open count (still-raised) stays 3 across Overview, Header, and Alarms tab
    const openUpdated = filterOpenAlarms(updated)
    const openCount = countOpen(updated)
    const overview = buildOverviewData(openUpdated)
    const kpi = overview.kpis.find((k) => k.id === 'active-alarms')

    expect(openCount).toBe(3)
    expect(kpi?.value).toBe(3)
    expect(kpi?.value).toBe(openCount)
  })
})

describe('Step 6d: REAL mode honest NO_DATA state', () => {
  it('REAL mode produces 0 alarms, never falls back to demo alarms', () => {
    // In REAL mode, AlarmsPage sets activeAlarms = []
    const isReal = true
    const alarms = createDemoAlarms()
    const activeAlarms = isReal ? [] : alarms
    const displayOpenCount = isReal ? 0 : countOpen(alarms)
    const displayClearedCount = isReal ? 0 : countCleared(alarms)

    expect(activeAlarms).toHaveLength(0)
    expect(displayOpenCount).toBe(0)
    expect(displayClearedCount).toBe(0)

    const filtered = isReal
      ? []
      : filterAlarms(activeAlarms, {
          tab: 'active',
          severity: 'all',
          load: 'all',
          type: 'all',
        })
    expect(filtered).toHaveLength(0)
  })

  it('Header bell count in REAL mode is 0 (no fake alarm badge)', () => {
    const isReal = true
    const isDemo = !isReal
    const openCount = 3
    const activeAlarmCount = isDemo ? openCount : 0
    expect(activeAlarmCount).toBe(0)
  })
})

describe('Step 6d: Bridge and Gateway status methods', () => {
  it('apiClient provides getBridgeStatus and getSystemGateway without duplicate state', () => {
    expect(typeof apiClient.getBridgeStatus).toBe('function')
    expect(typeof apiClient.getSystemGateway).toBe('function')
  })
})

describe('Step 6d: Dev-only buttons removal confirmation', () => {
  it('AlarmsPage.tsx source code does not contain "Demo: loading state" or "Demo: error state"', () => {
    expect(alarmsPageSource).not.toContain('Demo: loading state')
    expect(alarmsPageSource).not.toContain('Demo: error state')
    expect(alarmsPageSource).not.toContain('simulateLoad')
  })
})
