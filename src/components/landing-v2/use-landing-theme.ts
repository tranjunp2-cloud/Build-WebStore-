'use client'

import { useCallback, useEffect, useState } from 'react'

export const LV_THEME_KEY = 'lv2-theme'
export type LvTheme = 'dark' | 'light'

/** Dark by default; the saved choice is applied after mount so SSR markup stays stable. */
export function useLandingTheme() {
  const [theme, setTheme] = useState<LvTheme>('dark')

  useEffect(() => {
    try {
      if (window.localStorage.getItem(LV_THEME_KEY) === 'light') setTheme('light')
    } catch {
      /* storage blocked (private mode) — keep default */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    const next: LvTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      window.localStorage.setItem(LV_THEME_KEY, next)
    } catch {
      /* storage blocked — choice lasts for this visit only */
    }
  }, [theme])

  return { theme, toggleTheme }
}
