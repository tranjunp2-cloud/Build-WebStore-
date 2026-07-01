'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
    theme: Theme
    toggle: () => void
    setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
    return ctx
}

function applyTheme(t: Theme) {
    document.documentElement.classList.toggle('dark', t === 'dark')
    localStorage.setItem('theme', t)
    document.cookie = `theme=${t}; path=/; max-age=31536000; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
}

export function ThemeProvider({
    children,
    initialTheme = 'dark',
    forcedTheme,
}: {
    children: React.ReactNode
    initialTheme?: Theme
    /** Lock the subtree to one theme (e.g. auth). Toggle/setTheme become no-ops. */
    forcedTheme?: Theme
}) {
    const [theme, setThemeState] = useState<Theme>(forcedTheme ?? initialTheme)

    useEffect(() => {
        if (forcedTheme) {
            // Forced mode: only flip the html class, never persist — keeps the
            // user's dashboard theme (same `theme` key) untouched after they leave.
            document.documentElement.classList.toggle('dark', forcedTheme === 'dark')
            setThemeState(forcedTheme)
            return
        }
        // localStorage takes priority over SSR cookie on first mount
        const stored = localStorage.getItem('theme') as Theme | null
        const resolved = stored === 'light' || stored === 'dark' ? stored : initialTheme
        setThemeState(resolved)
        applyTheme(resolved)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const setTheme = useCallback((t: Theme) => {
        if (forcedTheme) return
        setThemeState(t)
        applyTheme(t)
    }, [forcedTheme])

    const toggle = useCallback(() => {
        if (forcedTheme) return
        setTheme(theme === 'dark' ? 'light' : 'dark')
    }, [theme, setTheme, forcedTheme])

    return (
        <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}
