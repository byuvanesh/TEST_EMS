/**
 * Real Authentication Context for TEST_EMS.
 *
 * Requirements:
 * - Wires to backend POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me, POST /api/auth/change-password
 * - Stores and resends CSRF token
 * - Tracks must_change_password status from the backend
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiClient, type ApiUser, ApiError } from '@/api/client'

export interface AuthContextValue {
  user: ApiUser | null
  isSignedIn: boolean
  isLoading: boolean
  mustChangePassword: boolean
  csrfToken: string | null
  login: (
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; mustChangePassword?: boolean; error?: string }>
  logout: () => Promise<void>
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ ok: boolean; error?: string }>
  checkSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkSession = useCallback(async () => {
    try {
      const res = await apiClient.getMe()
      setUser(res.user)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const login = useCallback(
    async (
      username: string,
      password: string,
    ): Promise<{ ok: boolean; mustChangePassword?: boolean; error?: string }> => {
      try {
        const res = await apiClient.login({ username, password })
        setUser(res.user)
        return {
          ok: true,
          mustChangePassword: res.user.mustChangePassword,
        }
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.statusCode === 429) {
            return {
              ok: false,
              error: 'Too many login attempts. Please wait a moment and try again.',
            }
          }
          if (err.code === 'INVALID_CREDENTIALS') {
            return { ok: false, error: 'Invalid username or password.' }
          }
          return { ok: false, error: err.message || 'Login failed.' }
        }
        return {
          ok: false,
          error: 'Network error. Could not connect to the authentication server.',
        }
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await apiClient.logout()
    } catch {
      // Ignored: clear state locally regardless
    } finally {
      setUser(null)
    }
  }, [])

  const changePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await apiClient.changePassword({
          currentPassword,
          newPassword,
        })
        if (res.ok) {
          setUser((prev) =>
            prev ? { ...prev, mustChangePassword: false } : null,
          )
        }
        return { ok: true }
      } catch (err) {
        if (err instanceof ApiError) {
          return { ok: false, error: err.message || 'Failed to update password.' }
        }
        return { ok: false, error: 'Network error updating password.' }
      }
    },
    [],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isSignedIn: user !== null,
      isLoading,
      mustChangePassword: user?.mustChangePassword ?? false,
      csrfToken: apiClient.getCsrfToken(),
      login,
      logout,
      changePassword,
      checkSession,
    }),
    [user, isLoading, login, logout, changePassword, checkSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
