/**
 * In-memory demo authentication context.
 *
 * This is a client-side navigation gate only. It is bypassable, does not
 * protect backend data, and resets on full page reload.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { readDemoAuthConfig } from '@/lib/demoAuthConfig'
import {
  changePassword as applyChangePassword,
  createInitialSession,
  dismissFirstLoginPrompt as applyDismiss,
  needsFirstLoginPrompt,
  signIn as applySignIn,
  signOut as applySignOut,
  type ChangePasswordResult,
  type DemoAuthSessionState,
  type SignInResult,
} from '@/lib/demoAuthLogic'

interface DemoAuthStoreValue {
  state: DemoAuthSessionState
  isSignedIn: boolean
  showFirstLoginPrompt: boolean
  signIn: (username: string, password: string) => SignInResult
  signOut: () => void
  changePassword: (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) => ChangePasswordResult
  dismissFirstLoginPrompt: () => void
}

const DemoAuthContext = createContext<DemoAuthStoreValue | null>(null)

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoAuthSessionState>(() =>
    createInitialSession(readDemoAuthConfig()),
  )

  const signIn = useCallback((username: string, password: string): SignInResult => {
    let result: SignInResult = { ok: false, reason: 'not_configured' }
    setState((prev) => {
      const next = applySignIn(prev, username, password)
      result = next.result
      return next.state
    })
    return result
  }, [])

  const signOut = useCallback(() => {
    setState((prev) => applySignOut(prev))
  }, [])

  const changePassword = useCallback(
    (
      currentPassword: string,
      newPassword: string,
      confirmPassword: string,
    ): ChangePasswordResult => {
      let result: ChangePasswordResult = { ok: false, reason: 'not_signed_in' }
      setState((prev) => {
        const next = applyChangePassword(
          prev,
          currentPassword,
          newPassword,
          confirmPassword,
        )
        result = next.result
        return next.state
      })
      return result
    },
    [],
  )

  const dismissFirstLoginPrompt = useCallback(() => {
    setState((prev) => applyDismiss(prev))
  }, [])

  const value = useMemo<DemoAuthStoreValue>(
    () => ({
      state,
      isSignedIn: state.signedIn,
      showFirstLoginPrompt: needsFirstLoginPrompt(state),
      signIn,
      signOut,
      changePassword,
      dismissFirstLoginPrompt,
    }),
    [state, signIn, signOut, changePassword, dismissFirstLoginPrompt],
  )

  return (
    <DemoAuthContext.Provider value={value}>{children}</DemoAuthContext.Provider>
  )
}

export function useDemoAuth(): DemoAuthStoreValue {
  const ctx = useContext(DemoAuthContext)
  if (!ctx) {
    throw new Error('useDemoAuth must be used within DemoAuthProvider')
  }
  return ctx
}
