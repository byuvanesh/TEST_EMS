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
  const loadReadings = loads.map((load) => {
    const sample = realLatest.get(load.id) ?? null
    if (sample) loadsReporting += 1
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
        active_power_kw: sample?.active_power_kw ?? null,
        current_a: sample?.current_a ?? null,
        voltage_v: sample?.voltage_v ?? null,
        power_factor: sample?.power_factor ?? null,
        frequency_hz: sample?.frequency_hz ?? null,
      },
    }
  })

  const siteDataState = loadsReporting === 0 ? 'NO_DATA' : 'UNKNOWN'

  return {
    origin_assurance: 'LABEL_ONLY' as const,
    source_type: 'REAL' as const,
    data_state: siteDataState,
    as_of: null as string | null,
    loads_expected: loads.length,
    loads_reporting: loadsReporting,
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
    analytics: unavailableAnalytics(),
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
