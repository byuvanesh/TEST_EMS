import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useDemoAuth } from '@/context/DemoAuthStore'
import { resolveAuthNavigation } from '@/lib/demoAuthLogic'

/** Client-side route gate only — not real security. */
export function RequireAuth() {
  const { isSignedIn } = useDemoAuth()
  const location = useLocation()
  const decision = resolveAuthNavigation(location.pathname, isSignedIn)

  if (decision === 'to_login') {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    )
  }

  return <Outlet />
}

/** Redirect signed-in users away from /login. */
export function PublicOnly() {
  const { isSignedIn } = useDemoAuth()
  const location = useLocation()
  const decision = resolveAuthNavigation(location.pathname, isSignedIn)

  if (decision === 'to_overview') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
