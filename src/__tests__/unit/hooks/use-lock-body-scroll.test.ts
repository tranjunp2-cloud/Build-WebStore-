import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll'

// ─── useLockBodyScroll [GH-1491 TC-F03.68-70] ──────────────────────────────

describe('useLockBodyScroll — body scroll lock for modals/popups [TC-F03.68-70]', () => {
    beforeEach(() => {
        document.body.style.overflow = ''
    })

    it('[TC-F03.68] locked=true sets body overflow hidden; unmount restores it', () => {
        const { unmount } = renderHook(() => useLockBodyScroll(true))
        expect(document.body.style.overflow).toBe('hidden')
        unmount()
        expect(document.body.style.overflow).toBe('')
    })

    it('[TC-F03.68] locked=false never locks the body', () => {
        const { unmount } = renderHook(() => useLockBodyScroll(false))
        expect(document.body.style.overflow).toBe('')
        unmount()
        expect(document.body.style.overflow).toBe('')
    })

    it('[TC-F03.69] toggling locked false→true→false locks then restores', () => {
        const { rerender, unmount } = renderHook(
            ({ locked }) => useLockBodyScroll(locked),
            { initialProps: { locked: false } }
        )
        expect(document.body.style.overflow).toBe('')

        rerender({ locked: true })
        expect(document.body.style.overflow).toBe('hidden')

        rerender({ locked: false })
        expect(document.body.style.overflow).toBe('')

        unmount()
        expect(document.body.style.overflow).toBe('')
    })

    it('[TC-F03.70] two overlapping locks: closing ONE keeps scroll locked while the other is still open', () => {
        // Two independent modals both calling the hook — e.g. a quick-view opened from
        // behind an already-open bulk-create modal (GH-1491 issue 1 audit finding).
        const a = renderHook(() => useLockBodyScroll(true))
        const b = renderHook(() => useLockBodyScroll(true))
        expect(document.body.style.overflow).toBe('hidden')

        a.unmount()
        // Modal B is still open — background must stay locked, not prematurely restored.
        expect(document.body.style.overflow).toBe('hidden')

        b.unmount()
        // Last lock released — now restore.
        expect(document.body.style.overflow).toBe('')
    })
})
