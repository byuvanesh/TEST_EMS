import { describe, expect, it } from 'vitest'
import type { DemoAuthConfig } from '@/lib/demoAuthConfig'
import {
  changePassword,
  changePasswordErrorMessage,
  createInitialSession,
  dismissFirstLoginPrompt,
  needsFirstLoginPrompt,
  passwordStrength,
  passwordStrengthHint,
  resolveAuthNavigation,
  signIn,
  signOut,
} from '@/lib/demoAuthLogic'

/** Test-only fixtures — not the documented demo credentials. */
const CONFIGURED: DemoAuthConfig = {
  configured: true,
  username: 'fixture-user',
  initialPassword: 'fixture-pass',
  missing: [],
}

const UNCONFIGURED: DemoAuthConfig = {
  configured: false,
  username: null,
  initialPassword: null,
  missing: ['VITE_DEMO_USERNAME', 'VITE_DEMO_PASSWORD'],
}

describe('demo sign-in', () => {
  it('accepts valid demo credentials', () => {
    const base = createInitialSession(CONFIGURED)
    const { state, result } = signIn(base, 'fixture-user', 'fixture-pass')
    expect(result).toEqual({ ok: true })
    expect(state.signedIn).toBe(true)
    expect(state.username).toBe('fixture-user')
    expect(needsFirstLoginPrompt(state)).toBe(true)
  })

  it('rejects invalid username', () => {
    const base = createInitialSession(CONFIGURED)
    const { state, result } = signIn(base, 'root', 'fixture-pass')
    expect(result).toEqual({ ok: false, reason: 'invalid_credentials' })
    expect(state.signedIn).toBe(false)
  })

  it('rejects invalid password', () => {
    const base = createInitialSession(CONFIGURED)
    const { state, result } = signIn(base, 'fixture-user', 'wrong')
    expect(result).toEqual({ ok: false, reason: 'invalid_credentials' })
    expect(state.signedIn).toBe(false)
  })

  it('fails clearly when credentials are not configured', () => {
    const base = createInitialSession(UNCONFIGURED)
    const { result } = signIn(base, 'fixture-user', 'fixture-pass')
    expect(result).toEqual({ ok: false, reason: 'not_configured' })
  })
})

describe('route protection decisions', () => {
  it('redirects unauthenticated users to login', () => {
    expect(resolveAuthNavigation('/', false)).toBe('to_login')
    expect(resolveAuthNavigation('/energy', false)).toBe('to_login')
    expect(resolveAuthNavigation('/alarms', false)).toBe('to_login')
    expect(resolveAuthNavigation('/system', false)).toBe('to_login')
    expect(resolveAuthNavigation('/loads/AC-01', false)).toBe('to_login')
  })

  it('allows the login route when signed out', () => {
    expect(resolveAuthNavigation('/login', false)).toBe('allow')
  })

  it('redirects signed-in users away from login to overview', () => {
    expect(resolveAuthNavigation('/login', true)).toBe('to_overview')
  })

  it('allows protected routes when signed in', () => {
    expect(resolveAuthNavigation('/', true)).toBe('allow')
    expect(resolveAuthNavigation('/loads/AC-02', true)).toBe('allow')
  })
})

describe('sign-out', () => {
  it('clears the in-memory signed-in session', () => {
    const signed = signIn(
      createInitialSession(CONFIGURED),
      'fixture-user',
      'fixture-pass',
    ).state
    const after = signOut(signed)
    expect(after.signedIn).toBe(false)
    expect(after.username).toBeNull()
    expect(resolveAuthNavigation('/energy', after.signedIn)).toBe('to_login')
  })
})

describe('change password validation', () => {
  function signedInSession() {
    return signIn(
      createInitialSession(CONFIGURED),
      'fixture-user',
      'fixture-pass',
    ).state
  }

  it('rejects wrong current password', () => {
    const { result } = changePassword(
      signedInSession(),
      'nope',
      'newpass12',
      'newpass12',
    )
    expect(result).toEqual({ ok: false, reason: 'wrong_current' })
    expect(changePasswordErrorMessage('wrong_current')).toMatch(/incorrect/i)
  })

  it('rejects password confirmation mismatch', () => {
    const { result } = changePassword(
      signedInSession(),
      'fixture-pass',
      'newpass12',
      'newpass99',
    )
    expect(result).toEqual({ ok: false, reason: 'mismatch' })
  })

  it('enforces minimum length of 8', () => {
    const { result } = changePassword(
      signedInSession(),
      'fixture-pass',
      'short',
      'short',
    )
    expect(result).toEqual({ ok: false, reason: 'too_short' })
  })

  it('requires new password different from current', () => {
    const { result } = changePassword(
      signedInSession(),
      'fixture-pass',
      'fixture-pass',
      'fixture-pass',
    )
    expect(result).toEqual({ ok: false, reason: 'same_as_current' })
  })

  it('updates in-memory password and marks first-login change complete', () => {
    const { state, result } = changePassword(
      signedInSession(),
      'fixture-pass',
      'newpass12',
      'newpass12',
    )
    expect(result).toEqual({ ok: true })
    expect(state.currentPassword).toBe('newpass12')
    expect(state.passwordChangedThisSession).toBe(true)
    expect(needsFirstLoginPrompt(state)).toBe(false)

    const reLogin = signOut(state)
    const again = signIn(reLogin, 'fixture-user', 'newpass12')
    expect(again.result.ok).toBe(true)
    expect(signIn(reLogin, 'fixture-user', 'fixture-pass').result.ok).toBe(
      false,
    )
  })

  it('exposes a simple password strength hint', () => {
    expect(passwordStrength('abc')).toBe('too-short')
    expect(passwordStrengthHint('abcdefgh')).toMatch(/Weak|Fair|Strong|characters/i)
    expect(passwordStrength('Abcdef1!xx')).toBe('strong')
  })
})

describe('first-login prompt', () => {
  it('shows after first successful login and can be dismissed without blocking', () => {
    const signed = signIn(
      createInitialSession(CONFIGURED),
      'fixture-user',
      'fixture-pass',
    ).state
    expect(needsFirstLoginPrompt(signed)).toBe(true)
    const continued = dismissFirstLoginPrompt(signed)
    expect(needsFirstLoginPrompt(continued)).toBe(false)
    expect(continued.signedIn).toBe(true)
  })
})

describe('session reset behaviour', () => {
  it('recreates initial password from config (simulates page reload)', () => {
    let session = signIn(
      createInitialSession(CONFIGURED),
      'fixture-user',
      'fixture-pass',
    ).state
    session = changePassword(
      session,
      'fixture-pass',
      'changed99',
      'changed99',
    ).state
    expect(session.currentPassword).toBe('changed99')

    // Full reload → new initial session from env/config.
    const reloaded = createInitialSession(CONFIGURED)
    expect(reloaded.signedIn).toBe(false)
    expect(reloaded.currentPassword).toBe('fixture-pass')
    expect(reloaded.passwordChangedThisSession).toBe(false)
  })
})
