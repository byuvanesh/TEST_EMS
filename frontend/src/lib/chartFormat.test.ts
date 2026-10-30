import { describe, expect, it } from 'vitest'
import { formatAxisTickParts } from '@/components/charts/UnitYAxisTick'
import {
  formatAxisTickWithUnit,
  formatChartMeasurement,
  formatPowerSeriesWindowLabel,
  isMissingMeasurement,
  isReportedZero,
  loadChartColor,
} from '@/lib/chartFormat'
import { overviewPowerSeries } from '@/lib/demoSeries'
import { DEMO_ANCHOR, parseIstWall } from '@/lib/period'

describe('chart measurement formatting', () => {
  it('distinguishes null from zero', () => {
    expect(formatChartMeasurement(null, 'kW')).toBe('No data')
    expect(formatChartMeasurement(undefined, 'kW')).toBe('No data')
    expect(formatChartMeasurement(0, 'kW')).toBe('0.0 kW')
    expect(formatChartMeasurement(0, 'kWh')).toBe('0.0 kWh')
    expect(formatChartMeasurement(3.2, 'kW')).toMatch(/3\.2 kW/)
    expect(isReportedZero(0)).toBe(true)
    expect(isReportedZero(null)).toBe(false)
    expect(isMissingMeasurement(null)).toBe(true)
    expect(isMissingMeasurement(0)).toBe(false)
  })

  it('keeps axis unit on one line with a non-breaking space', () => {
    const kw = formatAxisTickWithUnit(12.5, 'kW')
    const kwh = formatAxisTickWithUnit(128.6, 'kWh')
    expect(kw).toBe('12.5\u00A0kW')
    expect(kwh).toBe('129\u00A0kWh')
    expect(kw).not.toMatch(/\n/)
    expect(kw.includes(' ')).toBe(false) // only NBSP, no wrapping ASCII space
    expect(kw.includes('kW')).toBe(true)
    expect(formatAxisTickWithUnit(20, 'kW')).toBe('20.0\u00A0kW')
  })

  it('builds tick parts without an ASCII space (dual-tspan render)', () => {
    expect(formatAxisTickParts(20, 'kW')).toEqual({
      valueText: '20.0',
      unitText: 'kW',
    })
    expect(formatAxisTickParts(20, 'kWh')).toEqual({
      valueText: '20.0',
      unitText: 'kWh',
    })
  })


  it('preserves catalogue load colours', () => {
    expect(loadChartColor('AC-01')).toBe('#3B82F6')
    expect(loadChartColor('AC-02')).toBe('#0D9488')
    expect(loadChartColor('AC-03')).toBe('#7C3AED')
    expect(loadChartColor('Compressor-01')).toBe('#DB2777')
  })
})

describe('Overview 24-hour window', () => {
  it('aligns with DEMO_ANCHOR and spans 24 hourly points', () => {
    const series = overviewPowerSeries(24, DEMO_ANCHOR)
    expect(series).toHaveLength(24)
    const last = series[series.length - 1]
    expect(last?.timestamp.startsWith('2026-10-30T11:')).toBe(true)
    expect(parseIstWall(last!.timestamp).getTime()).toBeLessThanOrEqual(
      parseIstWall(DEMO_ANCHOR).getTime(),
    )
    const label = formatPowerSeriesWindowLabel(series)
    expect(label).toMatch(/–/)
    expect(label).not.toBe('No samples in window')
  })

  it('preserves null gaps in the overview window', () => {
    const series = overviewPowerSeries(24, DEMO_ANCHOR)
    const missing = series.filter((row) => row['AC-01'] === null)
    // Gaps are optional (~4%); when present they must stay null for all loads.
    for (const row of missing) {
      expect(row['AC-02']).toBeNull()
      expect(row['AC-03']).toBeNull()
      expect(row['Compressor-01']).toBeNull()
    }
  })
})
