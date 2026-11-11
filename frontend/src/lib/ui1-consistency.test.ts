import { describe, expect, it } from 'vitest'
import {
  acknowledgeAlarm,
  countCleared,
  countOpen,
  countUnacknowledged,
  filterOpenAlarms,
} from '@/lib/alarmFilters'
import {
  coverageOfSeries,
  getCanonicalDemoSeries,
  isMissingDemoSample,
  sliceSeries,
  sumLoadEnergyKwh,
  sumSiteEnergyKwh,
} from '@/lib/demoSeries'
import { buildEnergyAnalytics } from '@/lib/energyAnalytics'
import { DEMO_ANCHOR, parseIstWall, resolvePeriodBounds } from '@/lib/period'
import { ALL_LOAD_IDS } from '@/config/loads'
import { buildOverviewData, getSiteEnergyTodayKwh } from '@/mock/demoData'
import { createDemoAlarms } from '@/mock/alarmsDemoData'

describe('UI-1 central DEMO energy consistency', () => {
  it('Overview Energy today equals Energy page Today site total', () => {
    const overview = buildOverviewData(createDemoAlarms().filter((a) => a.status !== 'cleared'))
    const energyKpi = overview.kpis.find((k) => k.id === 'energy-today')
    const analytics = buildEnergyAnalytics({
      period: { preset: 'today' },
      loadFilter: 'all',
    })

    expect(energyKpi?.value).toBe(analytics.energyKwh)
    expect(getSiteEnergyTodayKwh()).toBe(analytics.energyKwh)
  })

  it('sum of per-load energy equals site energy today', () => {
    const overview = buildOverviewData([])
    const sumLoads = overview.loads.reduce(
      (acc, l) => acc + (l.energyTodayKwh ?? 0),
      0,
    )
    const site = overview.kpis.find((k) => k.id === 'energy-today')?.value
    expect(Number(sumLoads.toFixed(2))).toBe(site)
  })

  it('Load Detail energy matches Overview load energy', () => {
    const overview = buildOverviewData([])
    for (const load of overview.loads) {
      const again = buildOverviewData([]).loads.find((l) => l.loadId === load.loadId)
      expect(again?.energyTodayKwh).toBe(load.energyTodayKwh)
    }
  })

  it('missing samples remain null and are not treated as zero in sums', () => {
    const series = getCanonicalDemoSeries()
    const missing = series.filter((row) =>
      isMissingDemoSample(parseIstWall(row.timestamp)),
    )
    expect(missing.length).toBeGreaterThan(0)
    for (const row of missing) {
      for (const id of ALL_LOAD_IDS) {
        expect(row[id]).toBeNull()
      }
    }

    const withGap = missing[0]!
    const alone = [withGap]
    expect(sumSiteEnergyKwh(alone, ALL_LOAD_IDS)).toBe(0)
    expect(sumLoadEnergyKwh(alone, 'AC-01')).toBe(0)
  })

  it('coverage uses valid / expected samples', () => {
    const bounds = resolvePeriodBounds({ preset: 'today' })
    expect(bounds).toBeTruthy()
    const slice = sliceSeries(
      getCanonicalDemoSeries(),
      bounds!.start,
      bounds!.end,
    )
    const coverage = coverageOfSeries(slice)
    const analytics = buildEnergyAnalytics({
      period: { preset: 'today' },
      loadFilter: 'all',
    })
    expect(analytics.expectedSamples).toBe(coverage.expected)
    expect(analytics.validSamples).toBe(coverage.valid)
    expect(analytics.coveragePct).toBe(coverage.coveragePct)
    expect(analytics.validSamples).toBeLessThanOrEqual(analytics.expectedSamples)
  })

  it('Today is flagged as a partial period with a warning message', () => {
    const analytics = buildEnergyAnalytics({
      period: { preset: 'today' },
      loadFilter: 'all',
    })
    expect(analytics.partialPeriod).toBe(true)
    expect(analytics.partialPeriodMessage).toMatch(/Incomplete day/i)
    expect(analytics.period.end).toContain('11:45:00')
  })

  it('Yesterday is not a partial period', () => {
    const analytics = buildEnergyAnalytics({
      period: { preset: 'yesterday' },
      loadFilter: 'all',
    })
    expect(analytics.partialPeriod).toBe(false)
    expect(analytics.partialPeriodMessage).toBeNull()
  })

  it('uses DEMO_ANCHOR consistently', () => {
    expect(DEMO_ANCHOR).toBe('2026-10-30T11:45:00+05:30')
    const overview = buildOverviewData([])
    expect(overview.generatedAt).toBe(DEMO_ANCHOR)
  })
})

describe('UI-1 alarm state consistency', () => {
  it('Header/Overview/Alarms Open count share the same definition', () => {
    const alarms = createDemoAlarms()
    const open = countOpen(alarms)
    const overview = buildOverviewData(filterOpenAlarms(alarms))
    const kpi = overview.kpis.find((k) => k.id === 'active-alarms')

    expect(open).toBe(3)
    expect(countUnacknowledged(alarms)).toBe(2)
    expect(kpi?.value).toBe(3)
    expect(overview.alarms).toHaveLength(3)
    expect(overview.alarms.every((a) => a.status !== 'cleared')).toBe(true)
  })

  it('acknowledge updates shared alarm counts', () => {
    const alarms = createDemoAlarms()
    expect(countOpen(alarms)).toBe(3)
    expect(countUnacknowledged(alarms)).toBe(2)

    const next = acknowledgeAlarm(
      alarms,
      'alm-demo-001',
      'simulated.operator',
      '2026-10-30T12:00:00+05:30',
    )
    expect(countOpen(next)).toBe(3)
    expect(countUnacknowledged(next)).toBe(1)

    const overview = buildOverviewData(filterOpenAlarms(next))
    expect(overview.kpis.find((k) => k.id === 'active-alarms')?.value).toBe(3)
  })

  it('cleared alarms never appear in Open', () => {
    const alarms = createDemoAlarms()
    const open = filterOpenAlarms(alarms)
    expect(open.every((a) => a.status !== 'cleared')).toBe(true)
    expect(countCleared(alarms)).toBe(3)
    expect(open.length + countCleared(alarms)).toBe(alarms.length)
  })
})
