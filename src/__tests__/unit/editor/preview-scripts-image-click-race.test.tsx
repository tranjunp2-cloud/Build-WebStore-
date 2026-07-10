/**
 * Unit Tests: PreviewScripts — image tap vs block-select mutual exclusion
 * TC-IDs: TC-GH1557-05-01, TC-GH1557-05-02, TC-GH1557-05-03, TC-GH1557-06-01, TC-GH1557-05-04
 * Convention: docs/TEST_CONVENTION.md
 *
 * GH-1557 Bug 3/6: on compact/mobile, a tap on an editable image matched BOTH `onClick`'s
 * block-container detection (→ BLOCK_CONTAINER_CLICKED, opens the full mobile
 * block-settings sheet) AND the image-click branch (→ IMAGE_EDITING_STARTED, opens the
 * small Change-Image toolbar) — same tap, two competing UIs, the full-screen sheet
 * visually buried the toolbar. Fixed by detecting an editable-image target up front and
 * skipping the BLOCK_CONTAINER_CLICKED post for it — but ONLY when `?compact=1` (mobile/
 * tablet). Desktop has no such sheet (SettingsPanel is an always-visible side panel, not
 * an overlay) — selecting the block AND showing the image toolbar together there is
 * intentional existing behavior, so the fix must not change it (TC-GH1557-05-04).
 */

import { render } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PreviewScripts } from '@/components/editor/PreviewScripts'

describe('PreviewScripts — image click race (GH-1557 Bug 3/6)', () => {
    let mockPostMessage: ReturnType<typeof vi.fn>
    let originalParent: Window
    let originalUrl: string

    beforeEach(() => {
        vi.useFakeTimers()
        mockPostMessage = vi.fn()
        originalParent = window.parent
        // window !== window.parent — simulates running inside the editor's iframe
        Object.defineProperty(window, 'parent', {
            value: { postMessage: mockPostMessage },
            writable: true,
        })
        originalUrl = window.location.href
        // Default to compact/mobile mode (?compact=1) — the desktop test overrides this.
        window.history.pushState({}, '', '/editor/site-1?compact=1')
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
        document.body.innerHTML = ''
        Object.defineProperty(window, 'parent', { value: originalParent, writable: true })
        window.history.pushState({}, '', originalUrl)
    })

    function messagesOfType(type: string) {
        return mockPostMessage.mock.calls.filter(call => call[0]?.type === type)
    }

    it('TC-GH1557-05-01: tapping non-image block content still posts BLOCK_CONTAINER_CLICKED (no regression)', () => {
        document.body.innerHTML = `
            <div data-block-index="0" data-block-type="hero">
                <h1>Hero Title</h1>
            </div>
        `
        render(<PreviewScripts />)
        mockPostMessage.mockClear()

        document.querySelector('h1')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

        expect(messagesOfType('BLOCK_CONTAINER_CLICKED')).toHaveLength(1)
    })

    it('TC-GH1557-05-02: tapping an <img> skips BLOCK_CONTAINER_CLICKED but still posts IMAGE_EDITING_STARTED', () => {
        document.body.innerHTML = `
            <div data-block-index="0" data-block-type="hero">
                <img src="/hero.jpg" data-image-index="0" />
            </div>
        `
        render(<PreviewScripts />)
        mockPostMessage.mockClear()

        document.querySelector('img')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

        expect(messagesOfType('BLOCK_CONTAINER_CLICKED')).toHaveLength(0)
        expect(messagesOfType('IMAGE_EDITING_STARTED')).toHaveLength(1)
    })

    it('TC-GH1557-05-03: tapping a non-img placeholder with data-image-index also skips BLOCK_CONTAINER_CLICKED', () => {
        document.body.innerHTML = `
            <div data-block-index="2" data-block-type="logo-cloud">
                <div data-image-index="0" class="logo-placeholder">AB</div>
            </div>
        `
        render(<PreviewScripts />)
        mockPostMessage.mockClear()

        document.querySelector('.logo-placeholder')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

        expect(messagesOfType('BLOCK_CONTAINER_CLICKED')).toHaveLength(0)
        expect(messagesOfType('IMAGE_EDITING_STARTED')).toHaveLength(1)
    })

    it('TC-GH1557-06-01: tapping an image in a read-only block (products-featured) still posts BLOCK_CONTAINER_CLICKED', () => {
        document.body.innerHTML = `
            <div data-block-index="1" data-block-type="products-featured">
                <img src="/product.jpg" data-image-index="0" />
            </div>
        `
        render(<PreviewScripts />)
        mockPostMessage.mockClear()

        document.querySelector('img')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

        // Image isn't editable in this block type — mutual exclusion must not apply,
        // normal block-select should still work.
        expect(messagesOfType('BLOCK_CONTAINER_CLICKED')).toHaveLength(1)
    })

    it('TC-GH1557-05-04: on desktop (no ?compact=1), tapping an image posts BOTH messages — unchanged existing behavior', () => {
        window.history.pushState({}, '', '/editor/site-1') // no ?compact=1 — desktop
        document.body.innerHTML = `
            <div data-block-index="0" data-block-type="hero">
                <img src="/hero.jpg" data-image-index="0" />
            </div>
        `
        render(<PreviewScripts />)
        mockPostMessage.mockClear()

        document.querySelector('img')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

        // Desktop's SettingsPanel is an always-visible side panel, not an overlay — selecting
        // the block AND showing the floating image toolbar together is intentional here, so
        // the mutual-exclusion fix (compact-only) must not suppress BLOCK_CONTAINER_CLICKED.
        expect(messagesOfType('BLOCK_CONTAINER_CLICKED')).toHaveLength(1)
        expect(messagesOfType('IMAGE_EDITING_STARTED')).toHaveLength(1)
    })
})
