// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SaveBarLift } from '@/components/agent/save-bar-lift'

// TC-AIAUD-156 — a fixed save bar lifts the mascot: the bar marks <html> while it is mounted (an attribute,
// not a `:root:has(...)` rule that re-checks the whole document), and the lift keeps its desktop + mobile values.

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const lifted = () => document.documentElement.hasAttribute('data-save-bar')

afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-save-bar')
})

describe('SaveBarLift [TC-AIAUD-156]', () => {
    it('TC-AIAUD-156: marks the document root while a save bar is shown and clears it when the bar goes away', () => {
        expect(lifted()).toBe(false)

        const view = render(<SaveBarLift />)
        expect(lifted()).toBe(true)

        view.unmount()
        expect(lifted()).toBe(false)
    })

    it('TC-AIAUD-156: two bars at once keep the lift until the last one is gone', () => {
        const first = render(<SaveBarLift />)
        const second = render(<SaveBarLift />)

        first.unmount()
        expect(lifted()).toBe(true)
        second.unmount()
        expect(lifted()).toBe(false)
    })

    it('TC-AIAUD-156: globals.css lifts the mascot from the root attribute (88px, 132px on narrow screens) and no :root:has([data-save-bar])', () => {
        const css = read('src/app/globals.css')

        expect(css).toMatch(/:root\[data-save-bar\]\s*\{\s*--ech-ag-dock-bottom:\s*88px;/)
        expect(css).toMatch(/@media \(max-width: 640px\)\s*\{\s*:root\[data-save-bar\]\s*\{\s*--ech-ag-dock-bottom:\s*132px;/)
        expect(css).not.toMatch(/:root:has\(\[data-save-bar\]\)/)
    })

    it.each([
        'src/components/dashboard/product-form/ProductForm.tsx',
        'src/app/(dashboard)/settings/payments/PaymentsFormClient.tsx',
        'src/app/(dashboard)/settings/shipping/settings-footer.tsx',
        'src/app/(dashboard)/discounts/_components/discount-save-bar.tsx',
        'src/app/(dashboard)/customers/_components/customers-detail.tsx',
    ])('TC-AIAUD-156: %s mounts the lift inside its data-save-bar', (file) => {
        const source = read(file)
        const bar = source.indexOf('data-save-bar=""')

        expect(bar).toBeGreaterThan(-1)
        // the marker is the first thing inside the bar, before any of the bar's own content
        expect(source.indexOf('<SaveBarLift />', bar)).toBeGreaterThan(bar)
        expect(source.indexOf('<SaveBarLift />', bar) - bar).toBeLessThan(700)
        expect(source).toContain("from '@/components/agent/save-bar-lift'")
    })
})
