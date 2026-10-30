/**
 * DEMO overview bundle derived from the canonical DEMO series.
 * No independent power generators — Overview / Energy / Load Detail share one source.
 */

import { ALL_LOAD_IDS } from '@/config/loads'
import {
  getCanonicalDemoSeries,
  latestLoadPowerKw,
  overviewPowerSeries,
  sliceSeries,
  sumLoadEnergyKwh,
  sumSiteEnergyKwh,
  sitePowerAtSample,
} from '@/lib/demoSeries'
import { createSeededRandom, hashSeed } from '@/lib/seed'
import { DEMO_ANCHOR, parseIstWall, toIstIso } from '@/lib/period'
import type {
  AlarmItem,
  GatewayStatus,
  KpiSnapshot,
  LoadElectricalReading,
  LoadId,
  OverviewDemoBundle,
  PowerSeriesPoint,
  SiteInfo,
} from '@/types'

const SITE: SiteInfo = {
  id: 'site-demo-01',
  name: 'TEST_EMS Demo Site',
  timezone: 'Asia/Kolkata',
  timezoneLabel: 'IST',
}

const GATEWAY: GatewayStatus = {
  id: 'gw-demo-01',
  name: 'Site gateway (demo)',
  linkState: 'unknown',
  lastHeardAt: null,
  metersOnline: 0,
  metersTotal: 4,
  dataState: 'DEMO',
  note: 'Gateway hardware and Modbus master capability are unverified. This strip shows DEMO DATA only — not live communication status.',
}

function startOfDemoDayIso(asOfIso: string): string {
  const d = parseIstWall(asOfIso)
  return toIstIso(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0))
}

function demoPf(loadId: LoadId): number {
  const rand = createSeededRandom(hashSeed(`pf|${loadId}|${DEMO_ANCHOR}`))
  return Number((0.86 + rand() * 0.1).toFixed(2))
}

function buildLoadReading(loadId: LoadId, asOfIso: string): LoadElectricalReading {
  const series = getCanonicalDemoSeries()
  const latest = latestLoadPowerKw(series, loadId, asOfIso)
  const daySlice = sliceSeries(series, startOfDemoDayIso(asOfIso), asOfIso)
  const energyTodayKwh = sumLoadEnergyKwh(daySlice, loadId)
  const pf = demoPf(loadId)
  const power = latest.powerKw
  const voltageV = 415
  const currentA =
    power === null
      ? null
      : Number(((power * 1000) / (Math.sqrt(3) * voltageV * pf)).toFixed(1))

  return {
    loadId,
    dataState: 'DEMO',
    asOf: latest.asOf ?? asOfIso,
    activePowerKw: power,
    currentA,
    voltageV: power === null ? null : voltageV,
    powerFactor: power === null ? null : pf,
    frequencyHz: power === null ? null : 50,
    energyTodayKwh,
  }
}

function buildKpis(
  loads: LoadElectricalReading[],
  openAlarmCount: number,
  asOfIso: string,
): KpiSnapshot[] {
  const series = getCanonicalDemoSeries()
  const daySlice = sliceSeries(series, startOfDemoDayIso(asOfIso), asOfIso)
  const energyToday = sumSiteEnergyKwh(daySlice, ALL_LOAD_IDS)

  const totalPower = loads.reduce((acc, l) => {
    if (l.activePowerKw === null) return acc
    return acc + l.activePowerKw
  }, 0)

  let peak = 0
  for (const row of daySlice) {
    const site = sitePowerAtSample(row, ALL_LOAD_IDS)
    if (site !== null && site > peak) peak = site
  }

  const reporting = loads.filter((l) => l.activePowerKw !== null).length
  const pfValues = loads
    .map((l) => l.powerFactor)
    .filter((v): v is number => v !== null)
  const aggPf =
    pfValues.length > 0
      ? Number(
          (pfValues.reduce((a, b) => a + b, 0) / pfValues.length).toFixed(2),
        )
      : null

  return [
    {
      id: 'total-power',
      label: 'Total power',
      value: Number(totalPower.toFixed(1)),
      unit: 'kW',
      asOf: asOfIso,
      dataState: 'DEMO',
      note: `${reporting} of ${loads.length} loads (demo)`,
    },
    {
      id: 'energy-today',
      label: 'Energy today',
      value: energyToday,
      unit: 'kWh',
      asOf: asOfIso,
      dataState: 'DEMO',
      note: 'DEMO · incomplete day through snapshot',
    },
    {
      id: 'peak-demand',
      label: 'Peak power',
      value: Number(peak.toFixed(1)),
      unit: 'kW',
      asOf: asOfIso,
      dataState: 'DEMO',
      note: 'Interval TBD · demo hourly max today',
    },
    {
      id: 'aggregate-pf',
      label: 'Aggregate PF',
      value: aggPf,
      unit: '',
      asOf: asOfIso,
      dataState: 'DEMO',
      note: 'Mean of reporting loads (demo)',
    },
    {
      id: 'active-alarms',
      label: 'Open alarms',
      value: openAlarmCount,
      unit: '',
      asOf: asOfIso,
      dataState: 'DEMO',
      note: 'Active + acknowledged',
    },
  ]
}

function toPowerSeriesPoints(samples: ReturnType<typeof overviewPowerSeries>): PowerSeriesPoint[] {
  return samples.map((row) => ({
    timestamp: row.timestamp,
    hourLabel: row.hourLabel,
    'AC-01': row['AC-01'],
    'AC-02': row['AC-02'],
    'AC-03': row['AC-03'],
    'Compressor-01': row['Compressor-01'],
  }))
}

/**
 * Build overview DEMO bundle. Pass open alarms from the shared AlarmStore
 * so KPI / list stay consistent with Header and Alarms page.
 */
export function buildOverviewData(
  openAlarms: AlarmItem[],
  asOfIso: string = DEMO_ANCHOR,
): OverviewDemoBundle {
  const loads = ALL_LOAD_IDS.map((id) => buildLoadReading(id, asOfIso))
  return {
    site: SITE,
    globalDataState: 'DEMO',
    generatedAt: asOfIso,
    kpis: buildKpis(loads, openAlarms.length, asOfIso),
    loads,
    powerSeries: toPowerSeriesPoints(overviewPowerSeries(24, asOfIso)),
    alarms: openAlarms,
    gateway: GATEWAY,
  }
}

/** @deprecated Prefer buildOverviewData(openAlarms) with AlarmStore. */
export function getOverviewData(): OverviewDemoBundle {
  return buildOverviewData([])
}

export function getLoadEnergyTodayKwh(
  loadId: LoadId,
  asOfIso: string = DEMO_ANCHOR,
): number {
  const series = getCanonicalDemoSeries()
  const daySlice = sliceSeries(series, startOfDemoDayIso(asOfIso), asOfIso)
  return sumLoadEnergyKwh(daySlice, loadId)
}

export function getSiteEnergyTodayKwh(asOfIso: string = DEMO_ANCHOR): number {
  const series = getCanonicalDemoSeries()
  const daySlice = sliceSeries(series, startOfDemoDayIso(asOfIso), asOfIso)
  return sumSiteEnergyKwh(daySlice, ALL_LOAD_IDS)
}

export { LOAD_DEFINITIONS } from '@/config/loads'
export { DEMO_ANCHOR, SITE }
