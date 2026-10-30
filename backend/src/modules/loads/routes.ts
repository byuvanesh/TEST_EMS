import type { FastifyInstance } from 'fastify'
import { buildLoadDetail, buildLoadList } from '../../services/loadService.js'

export async function registerLoadRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { siteId?: string; source_type?: string } }>(
    '/api/v1/loads',
    async (req) => buildLoadList(req.query.siteId, req.query.source_type),
  )

  app.get<{
    Params: { loadId: string }
    Querystring: { source_type?: string }
  }>('/api/v1/loads/:loadId', async (req) =>
    buildLoadDetail(req.params.loadId, req.query.source_type),
  )
}
