// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { isInEditorEditMode, isInEditorPreview } from '@/lib/storefront/editor-intercept'

/**
 * Builder result preview (?builder=1) must allow link navigation so users can
 * explore the AI-generated site; the editor edit canvas (?editor=1) must still
 * block navigation. isInEditorEditMode() draws that line; isInEditorPreview()
 * stays true for BOTH modes (used to gate cart/checkout).
 */

const realParent = Object.getOwnPropertyDescriptor(window, 'parent')
const realLocation = Object.getOwnPropertyDescriptor(window, 'location')

function setupIframe(search: string, inIframe = true) {
    // Make window.parent !== window so the iframe guard passes.
    Object.defineProperty(window, 'parent', { value: inIframe ? {} : window, configurable: true })
    Object.defineProperty(window, 'location', { value: { search }, configurable: true })
}

afterEach(() => {
    if (realParent) Object.defineProperty(window, 'parent', realParent)
    if (realLocation) Object.defineProperty(window, 'location', realLocation)
})

describe('isInEditorEditMode (navigation gate)', () => {
    it('is true in the editor edit canvas (?editor=1)', () => {
        setupIframe('?editor=1&v=123')
        expect(isInEditorEditMode()).toBe(true)
    })

    it('is FALSE in the builder result preview (?builder=1) — navigation allowed', () => {
        setupIframe('?builder=1&v=123')
        expect(isInEditorEditMode()).toBe(false)
    })

    it('is false on the live storefront (no params, top window)', () => {
        setupIframe('?foo=bar', false)
        expect(isInEditorEditMode()).toBe(false)
    })
})

describe('isInEditorPreview (cart/checkout gate) — unchanged, true for both modes', () => {
    it('is true in editor mode (?editor=1)', () => {
        setupIframe('?editor=1')
        expect(isInEditorPreview()).toBe(true)
    })

    it('is true in builder mode (?builder=1)', () => {
        setupIframe('?builder=1')
        expect(isInEditorPreview()).toBe(true)
    })

    it('is false on the live storefront', () => {
        setupIframe('', false)
        expect(isInEditorPreview()).toBe(false)
    })
})
