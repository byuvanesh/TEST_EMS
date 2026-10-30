import type { FastifyInstance } from 'fastify'
import { getSiteById, listSites } from '../../repositories/catalogueRepository.js'
import { buildOverview } from '../../services/overviewService.js'

export async function registerSiteRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/sites', async () => {
    const sites = await listSites()
    return {
      origin_assurance: 'LABEL_ONLY',
      sites,
    }
  })

  app.get<{ Params: { siteId: string } }>('/api/v1/sites/:siteId', async (req) => {
    const site = await getSiteById(req.params.siteId)
    return {
      origin_assurance: 'LABEL_ONLY',
      site,
    }
  })

  app.get<{
    Params: { siteId: string }
    Querystring: { source_type?: string }
  }>('/api/v1/sites/:siteId/overview', async (req) => {
    return buildOverview(req.params.siteId, req.query.source_type)
  })
}
