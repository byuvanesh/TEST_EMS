import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Eye, EyeOff, Lock, User } from 'lucide-react'
import { useDemoAuth } from '@/context/DemoAuthStore'

function BrandVisual() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 640 800"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="loginGlow" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="45%" stopColor="#1d4ed8" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0a1628" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="loginLine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0" />
          <stop offset="40%" stopColor="#3b82f6" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.15" />
        </linearGradient>
        <pattern
          id="loginGrid"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M40 0H0V40"
            stroke="#1e3a5f"
            strokeWidth="1"
            strokeOpacity="0.55"
          />
        </pattern>
      </defs>

      <rect width="640" height="800" fill="url(#loginGrid)" />
      <rect width="640" height="800" fill="url(#loginGlow)" />

      {/* Circuit-inspired paths */}
      <path
        d="M80 180H220V280H340V220H460V360H560"
        stroke="url(#loginLine)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M120 520H240V440H360V500H480V420H580"
        stroke="#2563eb"
        strokeWidth="1.25"
        strokeOpacity="0.55"
        strokeLinecap="round"
      />
      <path
        d="M60 640H180V700H300V620H420"
        stroke="#60a5fa"
        strokeWidth="1"
        strokeOpacity="0.35"
        strokeLinecap="round"
      />

      {/* Nodes */}
      <circle cx="220" cy="180" r="4" fill="#60a5fa" />
      <circle cx="340" cy="280" r="5" fill="#3b82f6" />
      <circle cx="460" cy="220" r="4" fill="#93c5fd" />
      <circle cx="240" cy="520" r="4" fill="#60a5fa" opacity="0.8" />
      <circle cx="360" cy="440" r="5" fill="#2563eb" />
      <circle cx="480" cy="500" r="3.5" fill="#93c5fd" opacity="0.7" />

      {/* Abstract energy arcs */}
      <path
        d="M200 360C260 300 380 300 440 360C500 420 500 520 440 580C380 640 260 640 200 580C140 520 140 420 200 360Z"
        stroke="#3b82f6"
        strokeWidth="1.25"
        strokeOpacity="0.35"
      />
      <path
        d="M240 400C280 360 360 360 400 400C440 440 440 500 400 540C360 580 280 580 240 540C200 500 200 440 240 400Z"
        stroke="#60a5fa"
        strokeWidth="1"
        strokeOpacity="0.25"
      />
      <circle cx="320" cy="470" r="28" stroke="#3b82f6" strokeOpacity="0.4" />
      <circle cx="320" cy="470" r="12" fill="#2563eb" fillOpacity="0.35" />
      <circle cx="320" cy="470" r="4" fill="#93c5fd" />
    </svg>
  )
}

export function LoginPage() {
  const { state, signIn } = useDemoAuth()
  const navigate = useNavigate()
  const formId = useId()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!state.configured) {
      setError(
        `Demo credentials are not configured. Set ${state.missingEnv.join(' and ')} in a local .env file (see .env.example). Vite env values are embedded in the browser bundle and are NOT secrets.`,
      )
      return
    }

    setLoading(true)
    // Brief delay so the loading state is visible; still client-only demo UX.
    await new Promise((r) => setTimeout(r, 280))
    const result = signIn(username, password)
    setLoading(false)

    if (!result.ok) {
      if (result.reason === 'not_configured') {
        setError(
          'Demo credentials are not configured. Add VITE_DEMO_USERNAME and VITE_DEMO_PASSWORD to a local ignored env file.',
        )
      } else {
        setError('Invalid username or password.')
      }
      return
    }

    navigate('/', { replace: true })
  }

  const inputClass =
    'h-11 w-full rounded-[8px] border border-border bg-white py-2.5 pr-3 text-sm text-text outline-none transition-colors placeholder:text-text-secondary/60 hover:border-accent/40 focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:opacity-60'

  return (
    <div className="min-h-screen md:grid md:grid-cols-[minmax(260px,5fr)_minmax(320px,6fr)] lg:grid-cols-2">
      {/* Left — brand / visual identity (tablet + desktop) */}
      <aside className="relative hidden overflow-hidden bg-[#0a1628] text-white md:flex md:min-h-screen md:flex-col md:px-8 md:py-10 lg:px-12 lg:py-12 xl:px-16">
        <BrandVisual />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-accent shadow-[0_0_24px_rgba(37,99,235,0.45)]">
              <Activity className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">TEST_EMS</p>
              <p className="text-sm text-blue-200/80">Energy Management System</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center py-8 lg:py-10">
          <div className="max-w-md">
            <p className="text-2xl font-semibold tracking-tight text-white lg:text-3xl xl:text-4xl">
              Monitor. Analyze. Optimize.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-blue-100/70">
              Industrial-grade visibility into facility energy use — built for
              operators who need clarity, not clutter.
            </p>
          </div>
        </div>

        <p className="relative z-10 text-xs text-blue-200/50">
          Electrical monitoring only.
        </p>
      </aside>

      {/* Right — login form */}
      <main className="relative flex min-h-screen flex-col bg-[#f7f9fc]">
        {/* Mobile compact brand header */}
        <div className="relative overflow-hidden bg-[#0a1628] px-5 py-6 text-white md:hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            aria-hidden
          >
            <div className="absolute -top-16 right-0 h-40 w-40 rounded-full bg-accent/40 blur-3xl" />
            <div className="absolute bottom-0 left-8 h-24 w-24 rounded-full bg-blue-400/20 blur-2xl" />
          </div>
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent">
              <Activity className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight">TEST_EMS</p>
              <p className="text-xs text-blue-200/80">Energy Management System</p>
            </div>
          </div>
          <p className="relative z-10 mt-4 text-sm font-medium text-blue-100/90">
            Monitor. Analyze. Optimize.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 md:px-8 lg:px-12">
          <div className="w-full max-w-[400px]">
            <div className="mb-7">
              <h1 className="text-2xl font-semibold tracking-tight text-text">
                Welcome Back
              </h1>
              <p className="mt-1.5 text-sm text-text-secondary">
                Sign in to access your energy dashboard.
              </p>
            </div>

            <div className="rounded-[12px] border border-border bg-card p-6 shadow-[0_4px_24px_rgba(23,32,51,0.06)] sm:p-7">
              {!state.configured ? (
                <div className="space-y-3" role="alert">
                  <p className="text-sm font-semibold text-text">
                    Demo credentials not configured
                  </p>
                  <p className="text-xs leading-relaxed text-text-secondary">
                    Copy{' '}
                    <code className="rounded bg-surface px-1">.env.example</code>{' '}
                    to{' '}
                    <code className="rounded bg-surface px-1">.env.local</code>,
                    set the placeholder variables, then restart the Vite dev
                    server. Missing:{' '}
                    {state.missingEnv.join(', ') || 'unknown'}.
                  </p>
                  <p className="text-[11px] text-text-secondary">
                    Do not commit real-looking credentials. This mechanism must
                    never be used for production authentication.
                  </p>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                  <div>
                    <label
                      htmlFor={`${formId}-user`}
                      className="mb-1.5 block text-xs font-medium text-text"
                    >
                      Username
                    </label>
                    <div className="relative">
                      <User
                        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary"
                        aria-hidden
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
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor={`${formId}-pass`}
                      className="mb-1.5 block text-xs font-medium text-text"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock
                        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary"
                        aria-hidden
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
                        className={`${inputClass} pr-10 pl-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-[6px] p-1.5 text-text-secondary transition-colors hover:bg-surface hover:text-text"
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

                  {error ? (
                    <p
                      className="rounded-[8px] border border-critical/25 bg-critical/5 px-3 py-2 text-xs text-critical"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-11 w-full items-center justify-center rounded-[8px] bg-accent text-sm font-medium text-white shadow-[0_4px_14px_rgba(37,99,235,0.28)] transition-all hover:bg-[#1d4ed8] hover:shadow-[0_6px_18px_rgba(37,99,235,0.35)] disabled:cursor-not-allowed disabled:opacity-70"
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
                </form>
              )}
            </div>

            <p className="mt-6 text-center text-[11px] text-text-secondary md:hidden">
              Electrical monitoring only.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
