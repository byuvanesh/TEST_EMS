import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface DrawerProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
  className,
}: DrawerProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-text/30"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside
        className={cn(
          'relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-[0_4px_16px_rgba(23,32,51,0.08)]',
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] p-1.5 text-text-secondary hover:bg-surface"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <div className="border-t border-border px-4 py-3">{footer}</div>
        ) : null}
      </aside>
    </div>
  )
}
