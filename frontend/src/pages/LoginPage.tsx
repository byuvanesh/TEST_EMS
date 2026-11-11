import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  User,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useBranding } from '@/context/BrandingContext'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'

export function LoginPage() {
  const { login } = useAuth()
  const {
    companyName,
    logoUrl,
    showAttribution,
    attributionText,
    websiteLinkEnabled,
    websiteLinkText,
    websiteLinkUrl,
  } = useBranding()
  const navigate = useNavigate()
  const formId = useId()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [forcePasswordChangeOpen, setForcePasswordChangeOpen] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!username.trim() || !password) {
      setError('Please enter both username and password.')
      return
    }

    setLoading(true)
    const result = await login(username.trim(), password)
    setLoading(false)

    if (!result.ok) {
      setError(result.error || 'Invalid username or password.')
      return
    }

    if (result.mustChangePassword) {
      setForcePasswordChangeOpen(true)
      return
    }

    navigate('/', { replace: true })
  }

  const inputClass =
    'h-11 w-full rounded-[8px] border border-slate-200 bg-white py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70'

  return (
    <>
      <div className="min-h-screen min-h-[100dvh] flex flex-col justify-between bg-slate-50 text-slate-900 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
        {/* Main Content: Horizontally & Vertically Balanced Center Composition */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-8 w-full">
          <div data-testid="login-card-wrapper" className="w-full max-w-[420px] mx-auto">
            {/* 1. Company Branding — Vertical Stack (Logo -> Company Name -> Subtitle) */}
            <div data-testid="brand-vertical-stack" className="flex flex-col items-center text-center">
              {logoUrl ? (
                <div
                  data-testid="brand-logo-container"
                  className="mx-auto mb-3.5 flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-[12px] bg-white p-2 shadow-xs border border-slate-200/80"
                >
                  <img
                    src={logoUrl}
                    alt={companyName}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div
                  data-testid="brand-logo-container"
                  className="mx-auto mb-3.5 flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-[12px] bg-blue-600 text-white shadow-xs"
                >
                  <Activity className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
                </div>
              )}
              <h1
                data-testid="brand-company-name"
                className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-snug break-words text-center"
              >
                {companyName}
              </h1>
              <p
                data-testid="brand-subtitle"
                className="mt-1 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-semibold tracking-wider text-slate-500 uppercase text-center"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" aria-hidden="true" />
                Energy Management System
              </p>
            </div>

            {/* 2. Sign In Heading & Description: Center-aligned */}
            <div className="mt-6 mb-6 text-center">
              <h2
                data-testid="signin-heading"
                className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]"
              >
                Sign in
              </h2>
              <p data-testid="signin-description" className="mt-1.5 text-sm text-slate-500">
                Enter your credentials to access the facility dashboard.
              </p>
            </div>

            {/* 3. Login Form Card */}
            <div
              data-testid="login-card-container"
              className="rounded-[12px] border border-slate-200 bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(15,23,42,0.06)]"
            >
              <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                {/* Username Field — Left-aligned */}
                <div>
                  <label
                    htmlFor={`${formId}-user`}
                    className="mb-1.5 block text-xs font-semibold text-slate-700 text-left"
                  >
                    Username
                  </label>
                  <div className="relative">
                    <User
                      className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id={`${formId}-user`}
                      name="username"
                      type="text"
                      autoComplete="username"
                      autoFocus
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                      placeholder="Enter username"
                      className={`${inputClass} pl-10 pr-3 text-left`}
                    />
                  </div>
                </div>

                {/* Password Field — Left-aligned */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor={`${formId}-pass`}
                      className="block text-xs font-semibold text-slate-700 text-left"
                    >
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id={`${formId}-pass`}
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      placeholder="Enter password"
                      className={`${inputClass} pl-10 pr-10 text-left`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded-[6px] p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      disabled={loading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error Alert */}
                {error ? (
                  <div
                    className="flex items-start gap-2.5 rounded-[8px] border border-red-200 bg-red-50 p-3 text-xs text-red-700 leading-relaxed text-left"
                    role="alert"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>{error}</span>
                  </div>
                ) : null}

                {/* Primary Sign In Button: Full-width Blue */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-11 w-full items-center justify-center rounded-[8px] bg-blue-600 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600/30 active:translate-y-[0.5px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Signing in…
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>

                {/* Website Link: Directly Below Sign In Button, Center-Aligned */}
                {websiteLinkEnabled ? (
                  <div className="mt-4 flex justify-center">
                    <a
                      href={websiteLinkUrl || 'https://www.ellcrafts.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      data-testid="login-website-link"
                      title={`Visit ${websiteLinkText || 'www.ellcrafts.com'} (opens in a new tab)`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 tracking-tight transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 rounded-[4px] px-1 py-0.5"
                    >
                      <span>{websiteLinkText || 'www.ellcrafts.com'}</span>
                      <ExternalLink className="h-3 w-3 text-slate-700" />
                    </a>
                  </div>
                ) : null}
              </form>
            </div>
          </div>
        </main>

        {/* 4. Powered By Footer: Centered at bottom of viewport */}
        {showAttribution ? (
          <footer
            data-testid="platform-attribution-footer"
            className="px-4 py-4 sm:py-6 flex items-center justify-center text-xs text-slate-400 select-none text-center"
          >
            <span>
              Powered by{' '}
              <span className="font-semibold text-slate-700 tracking-tight">
                {attributionText || 'ELLCRAFTS'}
              </span>
            </span>
          </footer>
        ) : null}
      </div>

      <ChangePasswordDialog
        open={forcePasswordChangeOpen}
        forced={true}
        onSuccess={() => {
          setForcePasswordChangeOpen(false)
          navigate('/', { replace: true })
        }}
      />
    </>
  )
}
