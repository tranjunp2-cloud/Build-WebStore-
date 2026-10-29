import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// TC-AIAUD-187..188 — C3 mobile (live browser verify, 375px, /settings/payments): the compact mascot still covered
// the "Bank transfer" switch when it sat at the bottom of the screen (switch x 300-336, mascot x 332-368). On form
// screens at phone width the closed launcher is an edge tab: partly past the right edge, never over a control.

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
const agentCss = readFileSync(join(process.cwd(), 'packages/agent-ui/src/styles.css'), 'utf8')

/** The declarations of the phone-width quiet rule. */
function phoneQuietVars(): { right: number; zoom: number } {
    const block = css.match(/@media \(max-width: 640px\)\s*\{\s*:root\[data-agent-quiet\]\s*\{([^}]*)\}/)?.[1] ?? ''
    const right = Number(block.match(/--ech-ag-dock-right:\s*(-?\d+(?:\.\d+)?)px/)?.[1])
    const zoom = Number(block.match(/--ech-ag-fab-zoom:\s*(\d+(?:\.\d+)?)/)?.[1])
    return { right, zoom }
}

const FAB = 48 // .ech-ag-fab width (packages/agent-ui styles.css)
const VIEWPORT = 375
/** Where a card's right-aligned switch can end at 375px: 16px page padding + 20px card padding (live: x 336). */
const CONTROL_RIGHT_EDGE = VIEWPORT - 16 - 20

describe('quiet screens on a phone: the launcher is an edge tab [TC-AIAUD-187]', () => {
    it('TC-AIAUD-187: at 375px the closed launcher starts to the right of every control', () => {
        const { right, zoom } = phoneQuietVars()

        expect(Number.isFinite(right) && Number.isFinite(zoom)).toBe(true)
        const width = FAB * zoom
        const visibleLeft = VIEWPORT - right - width
        expect(right).toBeLessThan(0) // partly past the edge
        expect(visibleLeft).toBeGreaterThan(CONTROL_RIGHT_EDGE)
        // and enough of it shows to find and tap it
        expect(VIEWPORT - visibleLeft).toBeGreaterThanOrEqual(20)
    })

    it('TC-AIAUD-187: the edge tab is scoped to quiet screens and the closed launcher; the badge moves to the visible side', () => {
        expect(css).toMatch(/:root\[data-agent-quiet\] \.ech-ag-fab:not\(\.open\) \.ech-ag-fab-badge\s*\{\s*right:\s*auto;\s*left:\s*-8px;/)
        // the desktop quiet rule (6px, 80%) is unchanged and sits outside the media query
        expect(css).toMatch(/:root\[data-agent-quiet\]\s*\{\s*--ech-ag-dock-right:\s*6px;\s*--ech-ag-fab-zoom:\s*0\.8;\s*\}/)
    })

    it('TC-AIAUD-188: an open panel is not shifted off the edge (it keeps its own right margin and the full-screen sheet)', () => {
        expect(agentCss).toMatch(/\.ech-ag-float-root:has\(\.ech-ag-panel\)\s*\{\s*right:\s*20px;/)
        expect(agentCss).toMatch(/@media \(max-width: 640px\)\s*\{\s*\.ech-ag-float-root:has\(\.ech-ag-panel\)\s*\{\s*inset:\s*0;/)
    })
})
