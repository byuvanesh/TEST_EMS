import { closePools } from './pool.js'
import { runMigrations } from './migrate.js'

async function main(): Promise<void> {
  const result = await runMigrations()
  console.log(JSON.stringify({ ok: true, ...result }, null, 2))
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    await closePools()
  })
