import { getLoadById, listLoads } from '../repositories/catalogueRepository.js'
import {
  assertOperationalSourceType,
  dataStateForSample,
  getLatestRealSampleForLoad,
} from '../repositories/telemetryRepository.js'
import { unavailableAnalytics } from './overviewService.js'

export async function buildLoadList(siteId?: string, requestedSourceType?: string) {
  assertOperationalSourceType(requestedSourceType)
  const loads = await listLoads(siteId)
  return {
    origin_assurance: 'LABEL_ONLY' as const,
    source_type: 'REAL' as const,
    loads: loads.map((l) => ({
      id: l.id,
      site_id: l.site_id,
      code: l.code,
      name: l.name,
      capacity_label: l.capacity_label,
      chart_color: l.chart_color,
      sort_order: l.sort_order,
      is_active: Boolean(l.is_active),
    })),
  }
}

export async function buildLoadDetail(loadId: string, requestedSourceType?: string) {
  assertOperationalSourceType(requestedSourceType)
  const load = await getLoadById(loadId)
  const sample = await getLatestRealSampleForLoad(loadId)
  const data_state = dataStateForSample(sample)

  return {
    origin_assurance: 'LABEL_ONLY' as const,
    source_type: 'REAL' as const,
    data_state,
    as_of: sample ? sample.sample_time : null,
    load: {
      id: load.id,
      site_id: load.site_id,
      code: load.code,
      name: load.name,
      capacity_label: load.capacity_label,
      chart_color: load.chart_color,
    },
    measurements: {
      active_power_kw: sample?.active_power_kw ?? null,
      current_a: sample?.current_a ?? null,
      voltage_v: sample?.voltage_v ?? null,
      power_factor: sample?.power_factor ?? null,
      frequency_hz: sample?.frequency_hz ?? null,
      reactive_power_kvar: sample?.reactive_power_kvar ?? null,
      apparent_power_kva: sample?.apparent_power_kva ?? null,
      active_import_kwh: sample?.active_import_kwh ?? null,
    },
    analytics: unavailableAnalytics(),
  }
}
