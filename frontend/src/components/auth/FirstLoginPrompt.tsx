import { KeyRound } from 'lucide-react'
import { useDemoAuth } from '@/context/DemoAuthStore'

interface FirstLoginPromptProps {
  onOpenChangePassword: () => void
}

export function FirstLoginPrompt({
  onOpenChangePassword,
}: FirstLoginPromptProps) {
  const { showFirstLoginPrompt, dismissFirstLoginPrompt } = useDemoAuth()

  if (!showFirstLoginPrompt) return null

  return (
    <div
      className="mb-4 rounded-[12px] border border-warning/30 bg-warning/10 px-4 py-3"
      role="status"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-warning-text" />
          <div>
            <p className="text-sm font-semibold text-text">
              Demo first sign-in — consider changing the password
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
              This is a demo-only workflow. Changing the password updates memory
              for this session only. Choosing Continue lets you keep using the
              dashboard without blocking navigation. Reload resets the demo
              password to the configured env value.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 sm:pt-0.5">
          <button
            type="button"
            onClick={dismissFirstLoginPrompt}
            className="rounded-[8px] border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenChangePassword()
            }}
            className="rounded-[8px] bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Change password
          </button>
        </div>
      </div>
    </div>
  )
}
