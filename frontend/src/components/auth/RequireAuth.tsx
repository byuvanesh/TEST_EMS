import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

/** Server-authenticated route gate — redirects to /login if unauthenticated. */
export function RequireAuth() {
  const { isSignedIn, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span>Verifying session…</span>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    )
  }

  return <Outlet />
}

/** Redirect signed-in users away from /login to the dashboard. */
export function PublicOnly() {
  const { isSignedIn, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (isSignedIn) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
