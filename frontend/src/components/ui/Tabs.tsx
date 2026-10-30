import { cn } from '@/lib/cn'

interface TabItem<T extends string> {
  id: T
  label: string
  count?: number
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: TabsProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex flex-wrap gap-1 rounded-[8px] border border-border bg-surface p-1',
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'bg-card text-accent shadow-sm'
                : 'text-text-secondary hover:text-text',
            )}
          >
            {item.label}
            {typeof item.count === 'number' ? (
              <span className="ml-1.5 tabular text-text-secondary">
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
