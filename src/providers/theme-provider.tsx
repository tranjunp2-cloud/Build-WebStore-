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
    document.cookie = `theme=${t}; path=/; max-age=31536000; samesite=lax`
}

export function ThemeProvider({
    children,
    initialTheme = 'dark',
}: {
    children: React.ReactNode
    initialTheme?: Theme
}) {
    const [theme, setThemeState] = useState<Theme>(initialTheme)

    useEffect(() => {
        // localStorage takes priority over SSR cookie on first mount
        const stored = localStorage.getItem('theme') as Theme | null
        const resolved = stored === 'light' || stored === 'dark' ? stored : initialTheme
        setThemeState(resolved)
        applyTheme(resolved)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t)
        applyTheme(t)
    }, [])

    const toggle = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark')
    }, [theme, setTheme])

    return (
        <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}
