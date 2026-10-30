import { describe, expect, it } from 'vitest'
import {
  ACTUAL_ZERO_POWER_POINT,
  ALL_NULL_POWER_POINT,
  MIXED_NULL_POWER_FIXTURE,
  buildPowerTooltipRows,
  pointHasPartialMissing,
  seriesHasPartialMissing,
} from '@/lib/powerChartModel'

describe('mixed per-load null fixture', () => {
  const mixed = MIXED_NULL_POWER_FIXTURE[1]!

  it('keeps valid loads and leaves the missing load null', () => {
    expect(mixed['AC-01']).toBe(12)
    expect(mixed['AC-02']).toBeNull()
    expect(mixed['AC-03']).toBe(18)
    expect(mixed['Compressor-01']).toBe(8)
    expect(pointHasPartialMissing(mixed)).toBe(true)
    expect(seriesHasPartialMissing(MIXED_NULL_POWER_FIXTURE)).toBe(true)
  })

  it('tooltip shows No data for the missing load without fabricating zero', () => {
    const rows = buildPowerTooltipRows(mixed, 'kW')
    const byId = Object.fromEntries(rows.map((r) => [r.loadId, r]))

    expect(byId['AC-01']?.display).toBe('12.0 kW')
    expect(byId['AC-02']?.display).toBe('No data')
    expect(byId['AC-02']?.raw).toBeNull()
    expect(byId['AC-03']?.display).toBe('18.0 kW')
    expect(byId['Compressor-01']?.display).toBe('8.0 kW')

    expect(rows.some((r) => r.raw === 0 && r.loadId === 'AC-02')).toBe(false)
    expect(rows.every((r) => r.display !== '0.0 kW' || r.raw === 0)).toBe(true)
  })

  it('does not interpolate or invent a value for AC-02', () => {
    const rows = buildPowerTooltipRows(mixed, 'kW')
    const ac02 = rows.find((r) => r.loadId === 'AC-02')
    expect(ac02?.raw).toBeNull()
    expect(ac02?.display).toBe('No data')
    // Neighbours stay exact fixture values — no blending toward AC-02.
    expect(mixed['AC-01']).toBe(12)
    expect(mixed['AC-03']).toBe(18)
  })
})

describe('all-null and actual-zero remain distinct', () => {
  it('all-null point yields No data for every load', () => {
    const rows = buildPowerTooltipRows(ALL_NULL_POWER_POINT, 'kW')
    expect(rows.every((r) => r.raw === null && r.display === 'No data')).toBe(
      true,
    )
    expect(pointHasPartialMissing(ALL_NULL_POWER_POINT)).toBe(false)
  })

  it('actual zero remains 0.0 kW, not No data', () => {
    const rows = buildPowerTooltipRows(ACTUAL_ZERO_POWER_POINT, 'kW')
    expect(rows.every((r) => r.raw === 0 && r.display === '0.0 kW')).toBe(true)
    expect(pointHasPartialMissing(ACTUAL_ZERO_POWER_POINT)).toBe(false)
  })
})
