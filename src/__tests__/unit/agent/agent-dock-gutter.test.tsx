// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { useAgentQuietRoot } from '@/components/agent/agent-quiet-root'

// TC-AIAUD-167 — C3: the mascot must never trap an in-page control (Settings → Payments "Bank transfer" switch sits
// in the page body, not the save bar). Content always scrolls clear of the launcher (bottom gutter), and on form
// screens the launcher is compact and tucked into the corner so it clears right-aligned row controls.

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const quietRoot = () => document.documentElement.hasAttribute('data-agent-quiet')

function Probe({ path }: { path: string }) {
    useAgentQuietRoot(path)
    return null
}

afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-agent-quiet')
})

describe('quiet-screen launcher [TC-AIAUD-167]', () => {
    it.each(['/settings/payments', '/settings/shipping', '/products/42', '/products/new', '/discounts/new', '/customers/7'])(
        'TC-AIAUD-167: %s marks the root quiet and clears it on leaving',
        (path) => {
            const view = render(<Probe path={path} />)
            expect(quietRoot()).toBe(true)

            view.unmount()
            expect(quietRoot()).toBe(false)
        },
    )

    it.each(['/dashboard', '/orders', '/products', '/blog/12'])('TC-AIAUD-167: %s keeps the normal launcher', (path) => {
        render(<Probe path={path} />)
        expect(quietRoot()).toBe(false)
    })

    it('TC-AIAUD-167: navigating from a form screen to a list screen clears the mark', () => {
        const view = render(<Probe path="/settings/payments" />)
        expect(quietRoot()).toBe(true)

        view.rerender(<Probe path="/orders" />)
        expect(quietRoot()).toBe(false)
    })
})

describe('launcher styles [TC-AIAUD-167]', () => {
    it('TC-AIAUD-167: dashboard content has a bottom gutter that follows the launcher offset (incl. the save-bar lift)', () => {
        const css = read('src/app/globals.css')

        expect(css).toMatch(
            /\.dash-shell-root \.dash-content-gutter\s*\{\s*padding-bottom:\s*calc\(var\(--ech-ag-dock-bottom, 20px\) \+ 72px\);/,
        )
        expect(read('src/app/(dashboard)/_components/CMSLayoutClient.tsx')).toContain('dash-content-gutter')
    })

    it('TC-AIAUD-167: quiet screens tuck the launcher 6px from the edge at 80% size', () => {
        const css = read('src/app/globals.css')

        expect(css).toMatch(/:root\[data-agent-quiet\]\s*\{\s*--ech-ag-dock-right:\s*6px;\s*--ech-ag-fab-zoom:\s*0\.8;/)
    })

    it('TC-AIAUD-167: the dock and the placeholder read the same variables; an open panel keeps its normal size', () => {
        const dock = read('packages/agent-ui/src/styles.css')
        const placeholder = read('src/components/agent/AgentDockPlaceholder.tsx')

        expect(dock).toMatch(/\.ech-ag-float-root\s*\{[^}]*right:\s*var\(--ech-ag-dock-right, 20px\)/)
        expect(dock).toMatch(/\.ech-ag-fab:not\(\.open\)\s*\{\s*zoom:\s*var\(--ech-ag-fab-zoom, 1\)/)
        expect(dock).toMatch(/\.ech-ag-float-root:has\(\.ech-ag-panel\)\s*\{\s*right:\s*20px;/)
        expect(placeholder).toContain('var(--ech-ag-dock-right, 20px)')
        expect(placeholder).toContain('var(--ech-ag-fab-zoom, 1)')
    })

    it('TC-AIAUD-167: the loader applies the quiet mark for placeholder and dock alike', () => {
        expect(read('src/components/agent/DashboardAgentDockLoader.tsx')).toContain('useAgentQuietRoot(pathname)')
    })
})
