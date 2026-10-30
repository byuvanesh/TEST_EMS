/**
 * DEMO energy analytics derived from the canonical DEMO series only.
 *
 * Method (DEMO-only): sum of hourly active-power samples (kW × 1 h ≈ kWh).
 * Null samples are excluded from sums. Zero means a reported zero, not a gap.
 * Do not reuse for REAL meter-counter energy.
 */

import { ALL_LOAD_IDS } from '@/config/loads'
import {
  coverageOfSeries,
  getCanonicalDemoSeries,
  sliceSeries,
  sumLoadEnergyKwh,
  sumSiteEnergyKwh,
  sitePowerAtSample,
} from '@/lib/demoSeries'
import {
  DEMO_ANCHOR,
  parseIstWall,
  partialPeriodMessage,
  previousPeriodBounds,
  resolvePeriodBounds,
  isPartialPeriod,
  type ResolvePeriodInput,
} from '@/lib/period'
import type {
  DemandBucket,
  EnergyAnalyticsResult,
  EnergyBucket,
  LoadEnergyRow,
  LoadFilter,
  LoadId,
  PeriodBounds,
} from '@/types'

export function resolveIncludedLoads(filter: LoadFilter): LoadId[] {
  if (filter === 'all') return [...ALL_LOAD_IDS]
  return ALL_LOAD_IDS.filter((id) => id === filter)
}

export { demoPowerKw } from '@/lib/demoSeries'

const ENERGY_METHOD_NOTE =
  'DEMO method: hourly kW × 1 h ≈ kWh. Not meter import-counter deltas. Not for REAL telemetry.'

function bucketLabel(at: Date, preset: PeriodBounds['preset']): string {
  if (preset === 'today' || preset === 'yesterday') {
    return `${String(at.getHours()).padStart(2, '0')}:00`
  }
  return at.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export function shouldAggregateDaily(
  period: PeriodBounds,
  sampleCount: number,
): boolean {
  return (
    period.preset === 'month' ||
    period.preset === '7d' ||
    (period.preset === 'custom' && sampleCount > 48)
  )
}

function toEnergyBuckets(
  samples: ReturnType<typeof sliceSeries>,
  period: PeriodBounds,
  loads: LoadId[],
): EnergyBucket[] {
  const hourly: EnergyBucket[] = samples.map((row) => {
    const at = parseIstWall(row.timestamp)
    const point: EnergyBucket = {
      timestamp: row.timestamp,
      label: bucketLabel(at, period.preset),
      'AC-01': row['AC-01'],
      'AC-02': row['AC-02'],
      'AC-03': row['AC-03'],
      'Compressor-01': row['Compressor-01'],
    }
    for (const loadId of ALL_LOAD_IDS) {
      if (!loads.includes(loadId)) point[loadId] = null
    }
    return point
  })

  if (shouldAggregateDaily(period, samples.length)) {
    return aggregateDailyEnergy(hourly, loads)
  }
  return hourly
}

export function aggregateDailyEnergy(hourly: EnergyBucket[], loads: LoadId[]): EnergyBucket[] {
  const map = new Map<string, EnergyBucket>()
  for (const row of hourly) {
    const day = row.timestamp.slice(0, 10)
    const existing = map.get(day)
    if (!existing) {
      const labelDate = parseIstWall(row.timestamp)
      map.set(day, {
        timestamp: `${day}T00:00:00+05:30`,
        label: labelDate.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
        }),
        'AC-01': null,
        'AC-02': null,
        'AC-03': null,
        'Compressor-01': null,
      })
    }
    const bucket = map.get(day)!
    for (const loadId of ALL_LOAD_IDS) {
      const v = row[loadId]
      if (v === null || v === undefined) continue
      const prev = bucket[loadId]
      bucket[loadId] = Number(((prev ?? 0) + v).toFixed(2))
    }
  }
  return [...map.values()].map((row) => {
    const next = { ...row }
    for (const loadId of ALL_LOAD_IDS) {
      if (!loads.includes(loadId)) next[loadId] = null
    }
    return next
  })
}

function toDemandBuckets(
  samples: ReturnType<typeof sliceSeries>,
  period: PeriodBounds,
  loads: LoadId[],
): DemandBucket[] {
  const hourly: DemandBucket[] = samples.map((row) => ({
    timestamp: row.timestamp,
    label: bucketLabel(parseIstWall(row.timestamp), period.preset),
    powerKw: sitePowerAtSample(row, loads),
  }))

  if (shouldAggregateDaily(period, samples.length)) {
    return aggregateDailyDemand(hourly)
  }
  return hourly
}

/**
 * Daily average of valid hourly site power. Days with only missing samples stay null
 * (not zero). Missing hours are excluded from the average — never treated as 0 kW.
 */
export function aggregateDailyDemand(hourly: DemandBucket[]): DemandBucket[] {
  const map = new Map<
    string,
    { sum: number; count: number; timestamp: string }
  >()
  for (const row of hourly) {
    const day = row.timestamp.slice(0, 10)
    const existing = map.get(day)
    if (!existing) {
      map.set(day, {
        sum: 0,
        count: 0,
        timestamp: `${day}T00:00:00+05:30`,
      })
    }
    const bucket = map.get(day)!
    if (row.powerKw === null || row.powerKw === undefined) continue
    bucket.sum += row.powerKw
    bucket.count += 1
  }
  return [...map.values()].map((v) => ({
    timestamp: v.timestamp,
    label: parseIstWall(v.timestamp).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    }),
    powerKw:
      v.count === 0 ? null : Number((v.sum / v.count).toFixed(2)),
  }))
}

function peakForLoads(demand: DemandBucket[]): number {
  const values = demand
    .map((d) => d.powerKw)
    .filter((v): v is number => v !== null && v !== undefined)
  if (values.length === 0) return 0
  return Number(Math.max(...values).toFixed(2))
}

function averageForLoads(demand: DemandBucket[]): number {
  const values = demand
    .map((d) => d.powerKw)
    .filter((v): v is number => v !== null && v !== undefined)
  if (values.length === 0) return 0
  const sum = values.reduce((acc, v) => acc + v, 0)
  return Number((sum / values.length).toFixed(2))
}

function perLoadPowerStats(
  samples: ReturnType<typeof sliceSeries>,
  loads: LoadId[],
): { loadId: LoadId; peak: number; avg: number }[] {
  return loads.map((loadId) => {
    const values: number[] = []
    for (const row of samples) {
      const v = row[loadId]
      if (v !== null && v !== undefined) values.push(v)
    }
    const peak = values.length ? Math.max(...values) : 0
    const avg = values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0
    return {
      loadId,
      peak: Number(peak.toFixed(2)),
      avg: Number(avg.toFixed(2)),
    }
  })
}

export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

export function computeLoadRows(
  currentSamples: ReturnType<typeof sliceSeries>,
  previousSamples: ReturnType<typeof sliceSeries>,
  loads: LoadId[],
): LoadEnergyRow[] {
  const total = sumSiteEnergyKwh(currentSamples, loads) || 1
  const stats = perLoadPowerStats(currentSamples, loads)

  return loads.map((loadId) => {
    const energyKwh = sumLoadEnergyKwh(currentSamples, loadId)
    const previousEnergyKwh = sumLoadEnergyKwh(previousSamples, loadId)
    const loadStats = stats.find((s) => s.loadId === loadId)
    const contributionPct = Number(((energyKwh / total) * 100).toFixed(1))
    const energyDeltaPct =
      previousEnergyKwh === 0
        ? null
        : Number((((energyKwh - previousEnergyKwh) / previousEnergyKwh) * 100).toFixed(1))

    return {
      loadId,
      energyKwh,
      peakPowerKw: loadStats?.peak ?? 0,
      averagePowerKw: loadStats?.avg ?? 0,
      contributionPct,
      previousEnergyKwh,
      energyDeltaPct,
    }
  })
}

export interface BuildEnergyAnalyticsInput {
  period: ResolvePeriodInput
  loadFilter: LoadFilter
  anchorIso?: string
}

export function buildEnergyAnalytics(
  input: BuildEnergyAnalyticsInput,
): EnergyAnalyticsResult {
  const period = resolvePeriodBounds({
    ...input.period,
    anchorIso: input.anchorIso ?? DEMO_ANCHOR,
  })

  const emptyUnavailable = (reason: string): EnergyAnalyticsResult => ({
    dataState: 'DEMO',
    period: {
      preset: 'custom',
      start: '',
      end: '',
      label: 'Custom period incomplete',
    },
    previousPeriod: {
      preset: 'custom',
      start: '',
      end: '',
      label: '—',
    },
    loadFilter: input.loadFilter,
    includedLoads: resolveIncludedLoads(input.loadFilter),
    energyKwh: 0,
    previousEnergyKwh: 0,
    energyDeltaPct: null,
    peakPowerKw: 0,
    previousPeakPowerKw: 0,
    averagePowerKw: 0,
    previousAveragePowerKw: 0,
    coveragePct: 0,
    expectedSamples: 0,
    validSamples: 0,
    previousCoveragePct: 0,
    partialPeriod: false,
    partialPeriodMessage: null,
    coverageCompareNote: null,
    demandIntervalNote:
      'Demand interval is TBD — peak power below is demo hourly max, not a billing demand.',
    energyMethodNote: ENERGY_METHOD_NOTE,
    chartAggregation: 'hourly',
    energySeries: [],
    demandSeries: [],
    loadRows: [],
    unavailableReason: reason,
  })

  if (!period) {
    return emptyUnavailable(
      'Custom period requires a valid start and end date (end ≥ start).',
    )
  }

  const previous = previousPeriodBounds(period)
  const loads = resolveIncludedLoads(input.loadFilter)
  const series = getCanonicalDemoSeries()

  const currentSamples = sliceSeries(series, period.start, period.end)
  const previousSamples = sliceSeries(series, previous.start, previous.end)

  const coverage = coverageOfSeries(currentSamples)
  const previousCoverage = coverageOfSeries(previousSamples)

  const energyKwh = sumSiteEnergyKwh(currentSamples, loads)
  const previousEnergyKwh = sumSiteEnergyKwh(previousSamples, loads)

  const demandSeries = toDemandBuckets(currentSamples, period, loads)
  const previousDemand = toDemandBuckets(previousSamples, previous, loads)

  const peakPowerKw = peakForLoads(demandSeries)
  const previousPeakPowerKw = peakForLoads(previousDemand)
  const averagePowerKw = averageForLoads(demandSeries)
  const previousAveragePowerKw = averageForLoads(previousDemand)

  const coverageGap = Math.abs(coverage.coveragePct - previousCoverage.coveragePct)
  const coverageCompareNote =
    coverageGap >= 10
      ? `Coverage differs vs previous window (${coverage.coveragePct}% vs ${previousCoverage.coveragePct}%). Treat Δ% as directional DEMO only.`
      : null

  const partial = isPartialPeriod(period)

  return {
    dataState: 'DEMO',
    period,
    previousPeriod: previous,
    loadFilter: input.loadFilter,
    includedLoads: loads,
    energyKwh,
    previousEnergyKwh,
    energyDeltaPct: percentDelta(energyKwh, previousEnergyKwh),
    peakPowerKw,
    previousPeakPowerKw,
    averagePowerKw,
    previousAveragePowerKw,
    coveragePct: coverage.coveragePct,
    expectedSamples: coverage.expected,
    validSamples: coverage.valid,
    previousCoveragePct: previousCoverage.coveragePct,
    partialPeriod: partial,
    partialPeriodMessage: partialPeriodMessage(period),
    coverageCompareNote,
    demandIntervalNote:
      'Demand interval is TBD — peak shown is demo max of hourly samples, not a verified billing demand.',
    energyMethodNote: ENERGY_METHOD_NOTE,
    chartAggregation: shouldAggregateDaily(period, currentSamples.length)
      ? 'daily'
      : 'hourly',
    energySeries: toEnergyBuckets(currentSamples, period, loads),
    demandSeries,
    loadRows: computeLoadRows(currentSamples, previousSamples, loads),
  }
}

export function buildEnergyCsv(result: EnergyAnalyticsResult): string {
  const header = [
    'load_id',
    'energy_kwh',
    'peak_power_kw',
    'average_power_kw',
    'contribution_pct',
    'previous_energy_kwh',
    'energy_delta_pct',
    'period_label',
    'period_start',
    'period_end',
    'load_filter',
    'data_state',
    'coverage_pct',
    'partial_period',
  ]

  const rows = result.loadRows.map((row) =>
    [
      row.loadId,
      row.energyKwh,
      row.peakPowerKw,
      row.averagePowerKw,
      row.contributionPct,
      row.previousEnergyKwh,
      row.energyDeltaPct ?? '',
      result.period.label,
      result.period.start,
      result.period.end,
      result.loadFilter,
      result.dataState,
      result.coveragePct,
      result.partialPeriod ? 'yes' : 'no',
    ].join(','),
  )

  return [
    `# TEST_EMS DEMO DATA export — not live meter readings`,
    `# Period: ${result.period.label}`,
    `# Units: energy_kwh (kWh), power (kW)`,
    `# ${ENERGY_METHOD_NOTE}`,
    `# Demand interval: TBD (not verified)`,
    `# Tariff / cost: not included (tariff unconfirmed)`,
    header.join(','),
    ...rows,
  ].join('\n')
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function demoExpectedHours(period: PeriodBounds): number {
  return sliceSeries(getCanonicalDemoSeries(), period.start, period.end).length
}
