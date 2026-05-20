'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/providers/theme-provider'

export function ThemeToggle() {
    const { theme, toggle } = useTheme()
    const isDark = theme === 'dark'
    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex size-[38px] shrink-0 items-center justify-center rounded-[8px] border border-dash-border bg-dash-surface p-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent"
        >
            {isDark ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-amber-400" />}
        </button>
    )
}
