import type { FastifyInstance } from 'fastify'
import { unavailableAnalytics } from '../../services/overviewService.js'
import { assertOperationalSourceType } from '../../repositories/telemetryRepository.js'

export async function registerAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { source_type?: string } }>(
    '/api/v1/analytics/energy',
    async (req) => {
      assertOperationalSourceType(req.query.source_type)
      return {
        origin_assurance: 'LABEL_ONLY',
        ...unavailableAnalytics().energy,
      }
    },
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
