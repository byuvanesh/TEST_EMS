import { describe, expect, it } from 'vitest'
import { readDemoAuthConfig } from '@/lib/demoAuthConfig'

describe('demo auth config', () => {
  it('reports missing variables instead of inventing credentials', () => {
    const cfg = readDemoAuthConfig({
      VITE_DEMO_USERNAME: '',
      VITE_DEMO_PASSWORD: '',
    })
    expect(cfg.configured).toBe(false)
    expect(cfg.username).toBeNull()
    expect(cfg.initialPassword).toBeNull()
    expect(cfg.missing).toEqual([
      'VITE_DEMO_USERNAME',
      'VITE_DEMO_PASSWORD',
    ])
  })

  it('reads configured demo username and password from env-shaped input', () => {
    const cfg = readDemoAuthConfig({
      VITE_DEMO_USERNAME: ' fixture-user ',
      VITE_DEMO_PASSWORD: 'fixture-pass',
    })
    expect(cfg.configured).toBe(true)
    expect(cfg.username).toBe('fixture-user')
    expect(cfg.initialPassword).toBe('fixture-pass')
    expect(cfg.missing).toEqual([])
  })

  it('requires both username and password', () => {
    const userOnly = readDemoAuthConfig({
      VITE_DEMO_USERNAME: 'fixture-user',
      VITE_DEMO_PASSWORD: '',
    })
    expect(userOnly.configured).toBe(false)
    expect(userOnly.missing).toEqual(['VITE_DEMO_PASSWORD'])
  })
})
