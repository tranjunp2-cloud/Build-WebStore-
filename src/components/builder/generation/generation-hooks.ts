'use client'

import { type RefObject, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/** Subscribe to a media query. `fallback` is used when matchMedia is unavailable (SSR / jsdom). */
export function useMediaQuery(query: string, fallback: boolean, serverValue = fallback): boolean {
    return useSyncExternalStore(
        (notify) => {
            if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
            const mql = window.matchMedia(query)
            mql.addEventListener('change', notify)
            return () => mql.removeEventListener('change', notify)
        },
        () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : fallback),
        () => serverValue,
    )
}

export function usePrefersReducedMotion(): boolean {
    return useMediaQuery('(prefers-reduced-motion: reduce)', false)
}

const READ_INTERVAL_MS = 1400

/**
 * Rows read so far, one every READ_INTERVAL_MS. Keeps reading at the same pace after the theme
 * arrives (the stream sends it within seconds) but never completes the last row without it.
 */
export function useBriefReadCount(rowCount: number, hasTheme: boolean, instant = false): number {
    const max = hasTheme ? rowCount : Math.max(rowCount - 1, 0)
    const [count, setCount] = useState(0)
    useEffect(() => {
        if (instant || count >= max) return
        const id = window.setTimeout(() => setCount((c) => c + 1), READ_INTERVAL_MS)
        return () => window.clearTimeout(id)
    }, [count, max, instant])
    return instant ? max : Math.min(count, max)
}

/** True once `flag` has stayed true for `ms` (immediately when `instant`); resets when it drops. */
export function useDelayedTrue(flag: boolean, ms: number, instant = false): boolean {
    const [held, setHeld] = useState(false)
    useEffect(() => {
        if (!flag || instant) { setHeld(false); return }
        const id = window.setTimeout(() => setHeld(true), ms)
        return () => window.clearTimeout(id)
    }, [flag, ms, instant])
    return flag && (held || instant)
}

/** Reveals up to `target` items one per `intervalMs` while `enabled` (first one immediately). */
export function usePacedCount(target: number, intervalMs: number, enabled: boolean, instant = false): number {
    const [count, setCount] = useState(0)
    useEffect(() => {
        if (instant || !enabled || count >= target) return
        const id = window.setTimeout(() => setCount((c) => c + 1), count === 0 ? 0 : intervalMs)
        return () => window.clearTimeout(id)
    }, [count, target, intervalMs, enabled, instant])
    if (instant) return target
    return enabled ? Math.min(count, target) : 0
}

const TYPE_INTERVAL_MS = 55

/** Types `text` char-by-char once `active`; shows everything immediately when `instant`. */
export function useTypedText(text: string, active: boolean, instant: boolean): { text: string; typing: boolean } {
    const [len, setLen] = useState(0)
    useEffect(() => {
        if (!active || instant) return
        setLen(0)
        const id = window.setInterval(() => {
            setLen((l) => {
                if (l >= text.length) { window.clearInterval(id); return l }
                return l + 1
            })
        }, TYPE_INTERVAL_MS)
        return () => window.clearInterval(id)
    }, [text, active, instant])
    if (!active) return { text: '', typing: false }
    if (instant) return { text, typing: false }
    return { text: text.slice(0, len), typing: len < text.length }
}

/** False on first render, true on the next frame — drives enter transitions. */
export function useEntered(instant: boolean): boolean {
    const [entered, setEntered] = useState(instant)
    useEffect(() => {
        if (instant) { setEntered(true); return }
        const id = window.requestAnimationFrame(() => setEntered(true))
        return () => window.cancelAnimationFrame(id)
    }, [instant])
    return entered || instant
}

/** Observed content-box size of an element (0×0 until measured). */
export function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, { width: number; height: number }] {
    const ref = useRef<T | null>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })
    useEffect(() => {
        const el = ref.current
        if (!el || typeof ResizeObserver !== 'function') return
        const ro = new ResizeObserver(([entry]) => {
            const width = Math.round(entry.contentRect.width)
            const height = Math.round(entry.contentRect.height)
            setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    return [ref, size]
}

/** Eases a displayed number toward `target` (~1 unit per 45ms) so the % counter climbs instead of jumping. */
export function useSmoothNumber(target: number, instant: boolean): number {
    const [value, setValue] = useState(target)
    useEffect(() => {
        if (instant) { setValue(target); return }
        const id = window.setInterval(() => {
            setValue((v) => {
                if (Math.abs(target - v) < 1) { window.clearInterval(id); return target }
                return v + Math.sign(target - v) * Math.max(1, Math.abs(target - v) * 0.08)
            })
        }, 45)
        return () => window.clearInterval(id)
    }, [target, instant])
    return Math.round(value)
}
