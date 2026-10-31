import type { FastifyInstance } from 'fastify'
import { unavailableAnalytics } from '../../services/overviewService.js'
import { assertOperationalSourceType } from '../../repositories/telemetryRepository.js'
import { calculateEnergy } from '../../services/energyService.js'

export async function registerAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  const energyHandler = async (req: {
    query: { loadId?: string; siteId?: string; source_type?: string }
  }) => {
    const energy = await calculateEnergy(req.query.loadId, req.query.siteId, req.query.source_type)
    if (energy.intervals.length === 0) {
      return {
        ...energy,
        availability: 'UNAVAILABLE' as const,
        reason_codes: ['ENERGY_COUNTER_UNVERIFIED'],
        data_state: 'NO_DATA' as const,
      }
    }
    return {
      ...energy,
      availability: energy.has_gaps ? ('DEGRADED' as const) : ('AVAILABLE' as const),
      data_state: 'UNKNOWN' as const,
    }
  }

  app.get<{ Querystring: { loadId?: string; siteId?: string; source_type?: string } }>(
    '/api/v1/analytics/energy',
    energyHandler,
  )
  app.get<{ Querystring: { loadId?: string; siteId?: string; source_type?: string } }>(
    '/api/v1/energy',
    energyHandler,
  )
  app.get<{ Querystring: { loadId?: string; siteId?: string; source_type?: string } }>(
    '/api/energy',
    energyHandler,
  )

  app.get<{ Querystring: { source_type?: string } }>(
    '/api/v1/analytics/demand',
    async (req) => {
      assertOperationalSourceType(req.query.source_type)
      return {
        origin_assurance: 'LABEL_ONLY',
        ...unavailableAnalytics().demand,
      }
    },
  )

  app.get<{ Querystring: { source_type?: string } }>(
    '/api/v1/analytics/billing',
    async (req) => {
      assertOperationalSourceType(req.query.source_type)
      return {
        origin_assurance: 'LABEL_ONLY',
        ...unavailableAnalytics().billing,
      }
    },
  )

  app.get<{ Querystring: { source_type?: string } }>(
    '/api/v1/analytics/aggregate-pf',
    async (req) => {
      assertOperationalSourceType(req.query.source_type)
      return {
        origin_assurance: 'LABEL_ONLY',
        ...unavailableAnalytics().aggregate_pf,
      }
    },
  )
}
