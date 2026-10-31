import type { FastifyInstance } from 'fastify'
import { listSites } from '../../repositories/catalogueRepository.js'
import { buildOverview } from '../../services/overviewService.js'
import { notFound } from '../../utils/errors.js'

/**
 * Convenience overview for single-site Phase 2a deployments.
 * Prefer /api/v1/sites/:siteId/overview when site id is known.
 */
export async function registerOverviewRoutes(app: FastifyInstance): Promise<void> {
  const handler = async (req: { query: { source_type?: string } }) => {
    const sites = await listSites()
    const site = sites[0]
    if (!site) throw notFound('SITE_NOT_FOUND', 'No site configured')
    return buildOverview(site.id, req.query.source_type)
  }

  app.get<{ Querystring: { source_type?: string } }>('/api/v1/overview', handler)
  app.get<{ Querystring: { source_type?: string } }>('/api/overview', handler)
}
