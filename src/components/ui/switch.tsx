'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * GH-1222 — Standard Switch/Toggle.
 *
 * Fixed track/thumb size so it never stretches to row height inside a table cell
 * (the bug the hand-rolled `peer sr-only` clones had). Controlled via
 * `checked` + `onCheckedChange`. On = --dash-accent, off = muted track.
 */
export interface SwitchProps
    extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    checked: boolean
    onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
    ({ checked, onCheckedChange, disabled, className, onClick, ...props }, ref) => (
        <button
            ref={ref}
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={(e) => {
                onClick?.(e)
                if (!disabled) onCheckedChange?.(!checked)
            }}
            className={cn(
                // shrink-0 + fixed h/w → never stretches in a flex/table cell
                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                className,
            )}
            style={{
                background: checked ? 'var(--dash-accent)' : 'var(--dash-border)',
                border: 'none',
            }}
            {...props}
        >
            <span
                className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
            />
        </button>
    ),
)
Switch.displayName = 'Switch'

export { Switch }
