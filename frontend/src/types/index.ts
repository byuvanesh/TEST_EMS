/**
 * Shared domain types for TEST_EMS.
 * Mock data and future API responses should both map to these shapes.
 */

export type DataQualityState =
  | 'LIVE'
  | 'STALE'
  | 'OFFLINE'
  | 'DEMO'
  | 'NO_DATA'
  | 'UNKNOWN'
  | 'UNVERIFIED'

export type AlarmSeverity = 'critical' | 'warning' | 'info'

export type AlarmStatus = 'active' | 'acknowledged' | 'cleared'

/** SIMULATED alarm categories — limits themselves are TBD. */
export type AlarmType =
  | 'overcurrent'
  | 'undervoltage'
  | 'power_factor'
  | 'communication'
  | 'frequency'
  | 'other'

export type LoadId = 'AC-01' | 'AC-02' | 'AC-03' | 'Compressor-01'

export type GatewayLinkState = 'online' | 'degraded' | 'offline' | 'unknown'

export type EnergyPeriodPreset =
  | 'today'
  | 'yesterday'
  | '7d'
  | 'month'
  | 'custom'

export type LoadFilter = 'all' | LoadId

export type ConfigCertainty = 'CONFIRMED' | 'PROPOSED' | 'TBD' | 'NOT_CONFIGURED' | 'VERIFY'

export interface SiteInfo {
  id: string
  name: string
  timezone: string
  timezoneLabel: string
}

export interface LoadDefinition {
  id: LoadId
  name: string
  /** Human capacity label; Compressor capacity is TBD — do not invent. */
  capacityLabel: string
  chartColor: string
}

/** Electrical snapshot for a single load. Only electrical fields are in scope. */
export interface LoadElectricalReading {
  loadId: LoadId
  dataState: DataQualityState
  asOf: string
  activePowerKw: number | null
  currentA: number | null
  voltageV: number | null
  powerFactor: number | null
  frequencyHz: number | null
  energyTodayKwh: number | null
}

export interface KpiSnapshot {
  id: string
  label: string
  value: number | null
  unit: string
  asOf: string
  dataState: DataQualityState
  /** Optional supporting note, e.g. "3 of 4 loads (simulated)" */
  note?: string
}

export interface PowerSeriesPoint {
  timestamp: string
  hourLabel: string
  'AC-01': number | null
  'AC-02': number | null
  'AC-03': number | null
  'Compressor-01': number | null
}

/** Canonical SIMULATED hourly sample — null means missing (not zero load). */
export interface DemoHourlySample {
  timestamp: string
  hourLabel: string
  'AC-01': number | null
  'AC-02': number | null
  'AC-03': number | null
  'Compressor-01': number | null
}

export interface AlarmItem {
  id: string
  severity: AlarmSeverity
  status: AlarmStatus
  type: AlarmType
  title: string
  description: string
  loadId: LoadId | null
  raisedAt: string
  clearedAt: string | null
  acknowledgedAt: string | null
  acknowledgedBy: string | null
  dataState: DataQualityState
}

export interface GatewayStatus {
  id: string
  name: string
  linkState: GatewayLinkState
  lastHeardAt: string | null
  metersOnline: number
  metersTotal: number
  dataState: DataQualityState
  note: string
}

export interface OverviewDemoBundle {
  site: SiteInfo
  globalDataState: DataQualityState
  generatedAt: string
  kpis: KpiSnapshot[]
  loads: LoadElectricalReading[]
  powerSeries: PowerSeriesPoint[]
  alarms: AlarmItem[]
  gateway: GatewayStatus
}

export interface PeriodBounds {
  start: string
  end: string
  label: string
  preset: EnergyPeriodPreset
}

export interface EnergyBucket {
  timestamp: string
  label: string
  'AC-01': number | null
  'AC-02': number | null
  'AC-03': number | null
  'Compressor-01': number | null
}

export interface DemandBucket {
  timestamp: string
  label: string
  /** null when no included load reported a sample for this bucket. */
  powerKw: number | null
}

export interface LoadEnergyRow {
  loadId: LoadId
  energyKwh: number
  peakPowerKw: number
  averagePowerKw: number
  contributionPct: number
  previousEnergyKwh: number
  energyDeltaPct: number | null
}

export interface EnergyAnalyticsResult {
  dataState: DataQualityState
  period: PeriodBounds
  previousPeriod: PeriodBounds
  loadFilter: LoadFilter
  includedLoads: LoadId[]
  energyKwh: number
  previousEnergyKwh: number
  energyDeltaPct: number | null
  peakPowerKw: number
  previousPeakPowerKw: number
  averagePowerKw: number
  previousAveragePowerKw: number
  coveragePct: number
  expectedSamples: number
  validSamples: number
  previousCoveragePct: number
  /** True when the selected window does not cover a completed calendar day/month end. */
  partialPeriod: boolean
  partialPeriodMessage: string | null
  /** Set when current vs previous coverage differs materially. */
  coverageCompareNote: string | null
  /** Demand interval is TBD — never claim a verified interval. */
  demandIntervalNote: string
  /** SIMULATED-only: hourly kW × 1 h ≈ kWh. Not meter-counter energy. */
  energyMethodNote: string
  /** Whether chart series were rolled up to daily buckets. */
  chartAggregation: 'hourly' | 'daily'
  energySeries: EnergyBucket[]
  demandSeries: DemandBucket[]
  loadRows: LoadEnergyRow[]
  unavailableReason?: string
}

export interface ConfigField {
  label: string
  value: string
  certainty: ConfigCertainty
  note?: string
}
