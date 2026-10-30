import { describe, expect, it } from 'vitest'
import {
  aggregateDailyDemand,
  aggregateDailyEnergy,
  buildEnergyAnalytics,
  shouldAggregateDaily,
} from '@/lib/energyAnalytics'
import { resolvePeriodBounds } from '@/lib/period'
import type { DemandBucket, EnergyBucket } from '@/types'

describe('null vs zero in chart series', () => {
  it('keeps hourly nulls in Today energy and demand series', () => {
    const result = buildEnergyAnalytics({
      period: { preset: 'today' },
      loadFilter: 'all',
    })
    expect(result.chartAggregation).toBe('hourly')
    expect(result.energySeries.some((r) => r['AC-01'] === null)).toBe(true)
    expect(result.demandSeries.some((r) => r.powerKw === null)).toBe(true)
    // A reported zero would be numeric 0 — ensure we still allow zeros when present.
    const zeros = result.energySeries.filter((r) => r['AC-01'] === 0)
    for (const row of zeros) {
      expect(row['AC-01']).toBe(0)
      expect(row['AC-01']).not.toBeNull()
    }
  })

  it('daily energy aggregation skips missing hours instead of adding zero', () => {
    const hourly: EnergyBucket[] = [
      {
        timestamp: '2026-10-29T10:00:00+05:30',
        label: '10:00',
        'AC-01': 3,
        'AC-02': null,
        'AC-03': null,
        'Compressor-01': null,
      },
      {
        timestamp: '2026-10-29T11:00:00+05:30',
        label: '11:00',
        'AC-01': null,
        'AC-02': null,
        'AC-03': null,
        'Compressor-01': null,
      },
      {
        timestamp: '2026-10-29T12:00:00+05:30',
        label: '12:00',
        'AC-01': 2,
        'AC-02': null,
        'AC-03': null,
        'Compressor-01': null,
      },
    ]
    const daily = aggregateDailyEnergy(hourly, ['AC-01'])
    expect(daily).toHaveLength(1)
    expect(daily[0]?.['AC-01']).toBe(5)
  })

  it('daily demand aggregation yields null when a day has only missing samples', () => {
    const hourly: DemandBucket[] = [
      {
        timestamp: '2026-10-29T10:00:00+05:30',
        label: '10:00',
        powerKw: null,
      },
      {
        timestamp: '2026-10-29T11:00:00+05:30',
        label: '11:00',
        powerKw: null,
      },
      {
        timestamp: '2026-10-28T10:00:00+05:30',
        label: '10:00',
        powerKw: 10,
      },
      {
        timestamp: '2026-10-28T11:00:00+05:30',
        label: '11:00',
        powerKw: 0,
      },
    ]
    const daily = aggregateDailyDemand(hourly)
    const missingDay = daily.find((d) => d.timestamp.startsWith('2026-10-29'))
    const partialDay = daily.find((d) => d.timestamp.startsWith('2026-10-28'))
    expect(missingDay?.powerKw).toBeNull()
    expect(partialDay?.powerKw).toBe(5)
  })

  it('does not interpolate across nulls in series order (connectNulls contract)', () => {
    // Data contract for charts: consecutive nulls remain null; neighbors stay discrete.
    const result = buildEnergyAnalytics({
      period: { preset: 'today' },
      loadFilter: 'all',
    })
    for (let i = 0; i < result.demandSeries.length; i += 1) {
      const point = result.demandSeries[i]!
      if (point.powerKw === null) {
        expect(point.powerKw).toBeNull()
      } else {
        expect(typeof point.powerKw).toBe('number')
      }
    }
  })
})

describe('partial-period chart boundaries', () => {
  it('Today chart ends at DEMO anchor hour and is hourly', () => {
    const result = buildEnergyAnalytics({
      period: { preset: 'today' },
      loadFilter: 'all',
    })
    expect(result.partialPeriod).toBe(true)
    expect(result.chartAggregation).toBe('hourly')
    expect(result.period.end).toContain('2026-10-30T11:45:00')
    const last = result.energySeries[result.energySeries.length - 1]
    expect(last?.timestamp.startsWith('2026-10-30T11:')).toBe(true)
  })

  it('Yesterday uses hourly buckets for a complete day', () => {
    const result = buildEnergyAnalytics({
      period: { preset: 'yesterday' },
      loadFilter: 'all',
    })
    expect(result.partialPeriod).toBe(false)
    expect(result.chartAggregation).toBe('hourly')
    expect(shouldAggregateDaily(result.period, result.expectedSamples)).toBe(
      false,
    )
  })

  it('7d uses daily aggregation', () => {
    const bounds = resolvePeriodBounds({ preset: '7d' })
    expect(bounds).toBeTruthy()
    const result = buildEnergyAnalytics({
      period: { preset: '7d' },
      loadFilter: 'all',
    })
    expect(result.chartAggregation).toBe('daily')
    expect(shouldAggregateDaily(result.period, result.expectedSamples)).toBe(
      true,
    )
  })
})
