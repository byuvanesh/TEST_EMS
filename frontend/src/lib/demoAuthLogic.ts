/**
 * Pure demo auth session logic (in-memory only).
 * Not real authentication — client-side navigation gate for DEMO UX.
 */

import type { DemoAuthConfig } from '@/lib/demoAuthConfig'

export type PasswordStrength = 'too-short' | 'weak' | 'fair' | 'strong'

export interface DemoAuthSessionState {
  configured: boolean
  configUsername: string | null
  /** Current demo password (in memory). Starts from env; may change this session. */
  currentPassword: string | null
  signedIn: boolean
  username: string | null
  passwordChangedThisSession: boolean
  firstLoginPromptDismissed: boolean
  missingEnv: DemoAuthConfig['missing']
}

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'invalid_credentials' }

export type ChangePasswordResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'not_signed_in'
        | 'wrong_current'
        | 'too_short'
        | 'same_as_current'
        | 'mismatch'
    }

export function createInitialSession(
  config: DemoAuthConfig,
): DemoAuthSessionState {
  return {
    configured: config.configured,
    configUsername: config.username,
    currentPassword: config.initialPassword,
    signedIn: false,
    username: null,
    passwordChangedThisSession: false,
    firstLoginPromptDismissed: false,
    missingEnv: config.missing,
  }
}

export function passwordStrength(password: string): PasswordStrength {
  if (password.length < 8) return 'too-short'
  let score = 0
  if (password.length >= 10) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  if (score >= 3) return 'strong'
  if (score >= 2) return 'fair'
  return 'weak'
}

export function passwordStrengthHint(password: string): string {
  switch (passwordStrength(password)) {
    case 'too-short':
      return 'At least 8 characters required'
    case 'weak':
      return 'Weak — add mixed case, numbers, or symbols'
    case 'fair':
      return 'Fair — consider a longer or more varied password'
    case 'strong':
      return 'Strong enough for this demo'
  }
}

export function signIn(
  state: DemoAuthSessionState,
  username: string,
  password: string,
): { state: DemoAuthSessionState; result: SignInResult } {
  if (!state.configured || !state.configUsername || state.currentPassword == null) {
    return { state, result: { ok: false, reason: 'not_configured' } }
  }

  const userOk = username.trim() === state.configUsername
  const passOk = password === state.currentPassword
  if (!userOk || !passOk) {
    return { state, result: { ok: false, reason: 'invalid_credentials' } }
  }

  return {
    state: {
      ...state,
      signedIn: true,
      username: state.configUsername,
      firstLoginPromptDismissed: false,
    },
    result: { ok: true },
  }
}

export function signOut(state: DemoAuthSessionState): DemoAuthSessionState {
  return {
    ...state,
    signedIn: false,
    username: null,
    firstLoginPromptDismissed: false,
    // Keep in-memory password for the SPA lifetime; full reload resets from env.
  }
}

export function changePassword(
  state: DemoAuthSessionState,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): { state: DemoAuthSessionState; result: ChangePasswordResult } {
  if (!state.signedIn || state.currentPassword == null) {
    return { state, result: { ok: false, reason: 'not_signed_in' } }
  }
  if (currentPassword !== state.currentPassword) {
    return { state, result: { ok: false, reason: 'wrong_current' } }
  }
  if (newPassword === state.currentPassword) {
    return { state, result: { ok: false, reason: 'same_as_current' } }
  }
  if (newPassword.length < 8) {
    return { state, result: { ok: false, reason: 'too_short' } }
  }
  if (newPassword !== confirmPassword) {
    return { state, result: { ok: false, reason: 'mismatch' } }
  }

  return {
    state: {
      ...state,
      currentPassword: newPassword,
      passwordChangedThisSession: true,
      firstLoginPromptDismissed: true,
    },
    result: { ok: true },
  }
}

export function dismissFirstLoginPrompt(
  state: DemoAuthSessionState,
): DemoAuthSessionState {
  return { ...state, firstLoginPromptDismissed: true }
}

export function needsFirstLoginPrompt(state: DemoAuthSessionState): boolean {
  return (
    state.signedIn &&
    !state.passwordChangedThisSession &&
    !state.firstLoginPromptDismissed
  )
}

/** Client-side navigation gate only — not security. */
export type AuthNavDecision = 'allow' | 'to_login' | 'to_overview'

export function resolveAuthNavigation(
  pathname: string,
  signedIn: boolean,
): AuthNavDecision {
  const isLogin = pathname === '/login' || pathname.startsWith('/login/')
  if (!signedIn && !isLogin) return 'to_login'
  if (signedIn && isLogin) return 'to_overview'
  return 'allow'
}

export function changePasswordErrorMessage(
  reason: Extract<ChangePasswordResult, { ok: false }>['reason'],
): string {
  switch (reason) {
    case 'not_signed_in':
      return 'Sign in before changing the demo password.'
    case 'wrong_current':
      return 'Current password is incorrect.'
    case 'too_short':
      return 'New password must be at least 8 characters.'
    case 'same_as_current':
      return 'New password must differ from the current password.'
    case 'mismatch':
      return 'New password and confirmation do not match.'
  }
}
