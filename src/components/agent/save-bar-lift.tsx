'use client'

import { useEffect } from 'react'

/**
 * Rendered inside a fixed save bar (`data-save-bar`): while it is mounted the document root carries
 * `data-save-bar`, which globals.css reads to lift the ECH Agent mascot above the bar.
 *
 * A root attribute is toggled instead of a CSS `:root:has([data-save-bar])` rule because `:has()` on the root
 * makes the browser re-check the whole document whenever any node is added or removed.
 * Counted, so two bars mounted at once (or one replacing another) never clear it early.
 */
let mounted = 0

export function SaveBarLift(): null {
    useEffect(() => {
        const root = document.documentElement
        mounted += 1
        root.dataset.saveBar = ''
        return () => {
            mounted = Math.max(0, mounted - 1)
            if (mounted === 0) delete root.dataset.saveBar
        }
    }, [])
    return null
}
