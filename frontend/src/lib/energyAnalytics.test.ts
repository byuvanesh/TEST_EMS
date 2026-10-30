import { describe, expect, it } from 'vitest'
import {
  buildEnergyAnalytics,
  buildEnergyCsv,
  demoPowerKw,
  resolveIncludedLoads,
} from '@/lib/energyAnalytics'
import { resolvePeriodBounds } from '@/lib/period'
import { parseIstWall } from '@/lib/period'

describe('resolveIncludedLoads', () => {
  it('returns all loads for all filter', () => {
    expect(resolveIncludedLoads('all')).toEqual([
      'AC-01',
      'AC-02',
      'AC-03',
      'Compressor-01',
    ])
  })

  it('returns a single load when filtered', () => {
    expect(resolveIncludedLoads('AC-03')).toEqual(['AC-03'])
  })
})

describe('demoPowerKw', () => {
  it('is deterministic for the same timestamp', () => {
    const at = parseIstWall('2026-10-30T10:00:00+05:30')
    expect(demoPowerKw('AC-01', at)).toBe(demoPowerKw('AC-01', at))
  })
})

describe('buildEnergyAnalytics', () => {
  it('builds today analytics with DEMO state and coverage', () => {
    const result = buildEnergyAnalytics({
      period: { preset: 'today' },
      loadFilter: 'all',
    })

    expect(result.unavailableReason).toBeUndefined()
    expect(result.dataState).toBe('DEMO')
    expect(result.energyKwh).toBeGreaterThan(0)
    expect(result.loadRows).toHaveLength(4)
    expect(result.coveragePct).toBeGreaterThan(0)
    expect(result.demandIntervalNote).toMatch(/TBD/i)
    expect(result.energyMethodNote).toMatch(/DEMO/i)
    expect(result.partialPeriod).toBe(true)
    expect(result.chartAggregation).toBe('hourly')

    const contributions = result.loadRows.reduce(
      (sum, row) => sum + row.contributionPct,
      0,
    )
    expect(contributions).toBeGreaterThan(99)
    expect(contributions).toBeLessThan(101.5)
  })

  it('filters to one load and keeps contribution at 100%', () => {
    const result = buildEnergyAnalytics({
      period: { preset: 'yesterday' },
      loadFilter: 'AC-01',
    })

    expect(result.includedLoads).toEqual(['AC-01'])
    expect(result.loadRows).toHaveLength(1)
    expect(result.loadRows[0]?.contributionPct).toBe(100)
    expect(result.loadRows[0]?.energyKwh).toBe(result.energyKwh)
  })

  it('returns unavailable state for incomplete custom period', () => {
    const result = buildEnergyAnalytics({
      period: { preset: 'custom' },
      loadFilter: 'all',
    })

    expect(result.unavailableReason).toMatch(/Custom period/i)
    expect(result.energySeries).toHaveLength(0)
  })

  it('exports CSV that matches filtered load rows', () => {
    const result = buildEnergyAnalytics({
      period: { preset: '7d' },
      loadFilter: 'AC-02',
    })
    const csv = buildEnergyCsv(result)

    expect(csv).toContain('DEMO DATA')
    expect(csv).toContain('AC-02')
    expect(csv).not.toContain('\nAC-01,')
    expect(csv).toContain(String(result.energyKwh))
    expect(csv).toContain('partial_period')
  })

  it('resolves period bounds for this month', () => {
    const bounds = resolvePeriodBounds({ preset: 'month' })
    expect(bounds?.start).toContain('2026-10-01')
    expect(bounds?.end).toContain('2026-10-30')
  })

  it('keeps null gaps in hourly energy series for today', () => {
    const result = buildEnergyAnalytics({
      period: { preset: 'today' },
      loadFilter: 'all',
    })
    const hasNull = result.energySeries.some((row) =>
      (['AC-01', 'AC-02', 'AC-03', 'Compressor-01'] as const).some(
        (id) => row[id] === null,
      ),
    )
    expect(hasNull).toBe(true)
  })
})
