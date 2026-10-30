import { buildApp } from './app.js'
import { getEnv } from './config/env.js'
import { closePools } from './database/pool.js'

async function main(): Promise<void> {
  const env = getEnv()
  if (env.HOST !== '127.0.0.1' && env.HOST !== 'localhost') {
    console.warn(
      `Warning: HOST=${env.HOST}. Phase 2a is intended for localhost-only development.`,
    )
  }

  const app = await buildApp()
  await app.listen({ host: env.HOST, port: env.PORT })
  app.log.info(
    `TEST_EMS backend Phase 2a listening on http://${env.HOST}:${env.PORT} (no production ingest)`,
  )
}

main().catch(async (err) => {
  console.error(err)
  await closePools()
  process.exit(1)
})

process.on('SIGINT', async () => {
  await closePools()
  process.exit(0)
})
