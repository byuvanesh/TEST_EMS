import {
  getGatewaySummary,
  getSiteById,
  listLoads,
} from '../repositories/catalogueRepository.js'
import {
  assertOperationalSourceType,
  dataStateForSample,
  getLatestRealSamplesForSite,
} from '../repositories/telemetryRepository.js'

export async function buildOverview(siteId: string, requestedSourceType?: string) {
  assertOperationalSourceType(requestedSourceType)
  const site = await getSiteById(siteId)
  const loads = await listLoads(siteId)
  const realLatest = await getLatestRealSamplesForSite(siteId)
  const gateway = await getGatewaySummary(siteId)

  let loadsReporting = 0
  const missingLoads: string[] = []
  let totalKwSum = 0
  let totalKvaSum = 0
  let allKwValid = loads.length > 0
  let allKvaValid = loads.length > 0
  let latestSampleTime: string | null = null

  const loadReadings = loads.map((load) => {
    const sample = realLatest.get(load.id) ?? null
    const hasAnyMeasurement = sample && (
      sample.active_power_kw !== null ||
      sample.current_a !== null ||
      sample.voltage_v !== null ||
      sample.power_factor !== null ||
      sample.frequency_hz !== null ||
      sample.reactive_power_kvar !== null ||
      sample.apparent_power_kva !== null ||
      sample.active_import_kwh !== null
    )

    if (hasAnyMeasurement) {
      loadsReporting += 1
      if (!latestSampleTime || (sample && sample.sample_time > latestSampleTime)) {
        latestSampleTime = sample.sample_time
      }
    }

    const kw = sample?.active_power_kw ?? null
    const kva = sample?.apparent_power_kva ?? null

    if (kw === null) {
      allKwValid = false
      missingLoads.push(load.code)
    } else {
      totalKwSum += kw
    }

    if (kva === null) {
      allKvaValid = false
    } else {
      totalKvaSum += kva
    }

    const data_state = dataStateForSample(sample)
    return {
      load_id: load.id,
      code: load.code,
      name: load.name,
      capacity_label: load.capacity_label,
      chart_color: load.chart_color,
      data_state,
      as_of: sample ? sample.sample_time : null,
      measurements: {
        active_power_kw: kw,
        current_a: sample?.current_a ?? null,
        voltage_v: sample?.voltage_v ?? null,
        power_factor: sample?.power_factor ?? null,
        frequency_hz: sample?.frequency_hz ?? null,
        reactive_power_kvar: sample?.reactive_power_kvar ?? null,
        apparent_power_kva: kva,
        active_import_kwh: sample?.active_import_kwh ?? null,
      },
    }
  })

  // Step 5 Aggregation rules:
  // "Aggregation: total kW null + incomplete:true + missing_loads list if any load's metric is UNVERIFIED or missing. Aggregate PF = total kW / total kVA only when both verified for all loads, else null."
  const incomplete = !allKwValid
  const totalActivePowerKw = incomplete ? null : Number(totalKwSum.toFixed(4))
  const aggregatePf = (allKwValid && allKvaValid && totalKvaSum > 0)
    ? Number((totalKwSum / totalKvaSum).toFixed(4))
    : null

  const siteDataState = loadsReporting === 0 ? 'NO_DATA' : 'UNKNOWN'

  const analytics = {
    ...unavailableAnalytics(),
    aggregate_pf: aggregatePf !== null
      ? {
          availability: 'AVAILABLE' as const,
          value: aggregatePf,
          source_type: 'REAL' as const,
          data_state: 'UNKNOWN' as const,
        }
      : unavailableAnalytics().aggregate_pf,
  }

  return {
    origin_assurance: 'LABEL_ONLY' as const,
    source_type: 'REAL' as const,
    data_state: siteDataState,
    as_of: latestSampleTime,
    loads_expected: loads.length,
    loads_reporting: loadsReporting,
    total_active_power_kw: totalActivePowerKw,
    incomplete,
    missing_loads: missingLoads,
    aggregate_pf: aggregatePf,
    site: {
      id: site.id,
      code: site.code,
      name: site.name,
      timezone: site.timezone,
    },
    loads: loadReadings,
    gateway: gateway
      ? {
          id: gateway.id,
          code: gateway.code,
          name: gateway.name,
          rs485_master_verified: gateway.rs485_master_verified,
          auth_configured: gateway.auth_key_hash_present,
          link_state: 'unknown' as const,
          note: 'Gateway capability and connectivity are not verified in Phase 2a.',
        }
      : null,
    analytics,
    power_series: [] as unknown[],
    top_alarms: [] as unknown[],
  }
}

export function unavailableAnalytics() {
  return {
    energy: {
      availability: 'UNAVAILABLE' as const,
      reason_codes: ['ENERGY_COUNTER_UNVERIFIED'],
      source_type: 'REAL' as const,
      data_state: 'NO_DATA' as const,
    },
    demand: {
      availability: 'UNAVAILABLE' as const,
      reason_codes: ['DEMAND_INTERVAL_TBD'],
      source_type: 'REAL' as const,
      data_state: 'NO_DATA' as const,
    },
    billing: {
      availability: 'UNAVAILABLE' as const,
      reason_codes: ['TARIFF_TBD'],
      source_type: 'REAL' as const,
      data_state: 'NO_DATA' as const,
    },
    aggregate_pf: {
      availability: 'UNAVAILABLE' as const,
      reason_codes: ['AGG_PF_INPUTS_UNVERIFIED'],
      source_type: 'REAL' as const,
      data_state: 'NO_DATA' as const,
    },
  }
}
