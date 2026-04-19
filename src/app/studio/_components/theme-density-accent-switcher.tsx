'use client'

/**
 * ThemeDensityAccentSwitcher
 * Reads and writes localStorage keys:
 *   pw_theme    : 'light' | 'dark'
 *   pw_density  : 'compact' | 'default' | 'spacious'
 *   pw_accent   : 'blue' | 'teal' | 'violet' | 'slate'
 *   pw_sidebar_collapsed : 'true' | 'false'
 *
 * Applies changes to document.documentElement immediately (class + dataset).
 * Exported helpers are used by AdminTopbar and AdminSidebar.
 */
import { useEffect, useState, useCallback } from 'react'

export type Theme = 'light' | 'dark'
export type Density = 'compact' | 'default' | 'spacious'
export type Accent = 'blue' | 'teal' | 'violet' | 'slate'

const LS_THEME = 'pw_theme'
const LS_DENSITY = 'pw_density'
const LS_ACCENT = 'pw_accent'
const LS_SIDEBAR = 'pw_sidebar_collapsed'

function applyTheme(theme: Theme) {
    const el = document.documentElement
    if (theme === 'dark') {
        el.classList.add('dark')
    } else {
        el.classList.remove('dark')
    }
}

function applyDensity(density: Density) {
    document.documentElement.dataset.density = density
}

function applyAccent(accent: Accent) {
    document.documentElement.dataset.accent = accent
}

export function useStudioPreferences() {
    const [theme, setThemeState] = useState<Theme>('light')
    const [density, setDensityState] = useState<Density>('default')
    const [accent, setAccentState] = useState<Accent>('blue')
    const [sidebarCollapsed, setSidebarCollapsedState] = useState(false)

    // Hydrate from localStorage on mount
    useEffect(() => {
        const savedTheme = (localStorage.getItem(LS_THEME) as Theme) || 'light'
        const savedDensity = (localStorage.getItem(LS_DENSITY) as Density) || 'default'
        const savedAccent = (localStorage.getItem(LS_ACCENT) as Accent) || 'blue'
        const savedSidebar = localStorage.getItem(LS_SIDEBAR) === 'true'

        setThemeState(savedTheme)
        setDensityState(savedDensity)
        setAccentState(savedAccent)
        setSidebarCollapsedState(savedSidebar)

        applyTheme(savedTheme)
        applyDensity(savedDensity)
        applyAccent(savedAccent)
    }, [])

    const setTheme = useCallback((next: Theme) => {
        setThemeState(next)
        localStorage.setItem(LS_THEME, next)
        applyTheme(next)
    }, [])

    const setDensity = useCallback((next: Density) => {
        setDensityState(next)
        localStorage.setItem(LS_DENSITY, next)
        applyDensity(next)
    }, [])

    const setAccent = useCallback((next: Accent) => {
        setAccentState(next)
        localStorage.setItem(LS_ACCENT, next)
        applyAccent(next)
    }, [])

    const setSidebarCollapsed = useCallback((next: boolean) => {
        setSidebarCollapsedState(next)
        localStorage.setItem(LS_SIDEBAR, String(next))
    }, [])

    return {
        theme, setTheme,
        density, setDensity,
        accent, setAccent,
        sidebarCollapsed, setSidebarCollapsed,
    }
}
