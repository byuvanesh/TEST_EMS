import type { FastifyInstance } from 'fastify'
import { buildLoadDetail, buildLoadHistory, buildLoadList } from '../../services/loadService.js'

export async function registerLoadRoutes(app: FastifyInstance): Promise<void> {
  const listHandler = async (req: { query: { siteId?: string; source_type?: string } }) =>
    buildLoadList(req.query.siteId, req.query.source_type)

  app.get<{ Querystring: { siteId?: string; source_type?: string } }>('/api/v1/loads', listHandler)
  app.get<{ Querystring: { siteId?: string; source_type?: string } }>('/api/loads', listHandler)

  const detailHandler = async (req: { params: { loadId: string }; query: { source_type?: string } }) =>
    buildLoadDetail(req.params.loadId, req.query.source_type)

  app.get<{
    Params: { loadId: string }
    Querystring: { source_type?: string }
  }>('/api/v1/loads/:loadId', detailHandler)

  app.get<{
    Params: { loadId: string }
    Querystring: { source_type?: string }
  }>('/api/loads/:loadId', detailHandler)

  const historyHandler = async (req: {
    params: { loadId: string }
    query: { limit?: string; source_type?: string }
  }) => {
    const limit = req.query.limit ? Number(req.query.limit) : 50
    return buildLoadHistory(req.params.loadId, limit, req.query.source_type)
  }

  app.get<{
    Params: { loadId: string }
    Querystring: { limit?: string; source_type?: string }
  }>('/api/v1/loads/:loadId/history', historyHandler)

  app.get<{
    Params: { loadId: string }
    Querystring: { limit?: string; source_type?: string }
  }>('/api/loads/:loadId/history', historyHandler)
}

