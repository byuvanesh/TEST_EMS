import type { FastifyInstance } from 'fastify'
import { getActiveBridge } from '../../services/bridgeService.js'

export async function registerBridgeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/bridge/status', async (_req, reply) => {
    const bridge = getActiveBridge()
    if (!bridge) {
      return reply.status(200).send({
        status: 'disabled',
        mode: 'none',
        last_receive_time: null,
        metrics: {
          pollsTotal: 0,
          pollsOk: 0,
          pollsError: 0,
          wsFramesTotal: 0,
          archiveInserts: 0,
          archiveDuplicates: 0,
          archiveOversized: 0,
          tsReversals: 0,
          decodeErrors: 0,
          authErrors: 0,
        },
      })
    }
    return reply.status(200).send(bridge.getStatus())
  })
}
