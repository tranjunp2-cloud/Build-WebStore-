'use client'

import { useEffect } from 'react'

/**
 * Module-level lock count — not component state, since it must be shared across every
 * independent useLockBodyScroll() caller on the page. Restoring scroll only when the
 * LAST lock releases means two overlapping locked modals (e.g. one opened from behind
 * another) don't prematurely unlock the background when just one of them closes.
 */
let lockCount = 0
let previousOverflow = ''

/**
 * Locks page scroll while `locked` is true — for modals/popups whose overlay covers the
 * viewport, so the background page can't be scrolled behind it (GH-1491 issue 1). Mirrors
 * the inline `document.body.style.overflow` pattern already used across the codebase
 * (ProductQuickViewModal, CartDrawer, etc.) as a shared, ref-counted hook instead of each
 * call site re-implementing its own unguarded set/restore.
 *
 * Restores the overflow value captured just before the FIRST lock (not a hardcoded '')
 * so this doesn't clobber an unrelated inline lock set by legacy call sites when they
 * overlap on the same page (e.g. ProductQuickViewModal + BulkCreateModal on /products).
 */
export function useLockBodyScroll(locked: boolean) {
    useEffect(() => {
        if (!locked) return
        if (lockCount === 0) previousOverflow = document.body.style.overflow
        lockCount++
        document.body.style.overflow = 'hidden'
        return () => {
            lockCount--
            if (lockCount === 0) document.body.style.overflow = previousOverflow
        }
    }, [locked])
}
