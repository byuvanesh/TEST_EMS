/**
 * Demo sign-in configuration from Vite env.
 *
 * IMPORTANT: Any `VITE_*` value is embedded in the client bundle and visible
 * to anyone who loads the app. These are NOT secrets and must NEVER be used
 * for production authentication.
 */

export interface DemoAuthConfig {
  configured: boolean
  username: string | null
  /** Initial demo password from env — held in memory after boot; never persist. */
  initialPassword: string | null
  missing: Array<'VITE_DEMO_USERNAME' | 'VITE_DEMO_PASSWORD'>
}

export function readDemoAuthConfig(
  env: Pick<ImportMetaEnv, 'VITE_DEMO_USERNAME' | 'VITE_DEMO_PASSWORD'> = import.meta
    .env,
): DemoAuthConfig {
  const username = (env.VITE_DEMO_USERNAME ?? '').trim()
  const initialPassword = env.VITE_DEMO_PASSWORD ?? ''
  const missing: DemoAuthConfig['missing'] = []
  if (!username) missing.push('VITE_DEMO_USERNAME')
  if (!initialPassword) missing.push('VITE_DEMO_PASSWORD')

  if (missing.length > 0) {
    return {
      configured: false,
      username: null,
      initialPassword: null,
      missing,
    }
  }

  return {
    configured: true,
    username,
    initialPassword,
    missing: [],
  }
}
