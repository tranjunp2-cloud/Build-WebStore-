'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/providers/theme-provider'

export function ThemeToggle() {
    const { theme, toggle } = useTheme()
    const isDark = theme === 'dark'
    return (
        <button
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={
                isDark
                    ? 'flex size-[38px] shrink-0 items-center justify-center rounded-[8px] border border-[#1F2937] bg-[#0B1120] p-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]'
                    : 'flex size-[38px] shrink-0 items-center justify-center rounded-[8px] border border-[#9CA3AF] bg-white p-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]'
            }
        >
            {isDark ? <Moon size={20} className="text-amber-400" /> : <Sun size={20} className="text-amber-400" />}
        </button>
    )
}
