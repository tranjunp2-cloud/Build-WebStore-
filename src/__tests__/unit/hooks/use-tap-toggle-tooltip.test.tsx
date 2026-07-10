// @vitest-environment jsdom
/**
 * Component Render Tests — useTapToggleTooltip (GH-1502, code-review follow-up)
 * Coverage Map:
 *   TC-F08-04-63 → Click on trigger opens the (real, unmocked) tooltip
 *   TC-F08-04-64 → Pointerdown outside an open trigger closes it
 *
 * Uses the REAL @/components/ui/tooltip (Radix), not a mock — the consumer
 * tests (ai-review-indicator.test.tsx, missing-info-indicator.test.tsx) mock
 * Tooltip entirely and always render TooltipContent unconditionally, so they
 * never exercise real Radix open/close behavior at all.
 *
 * NOT covered here: the exact composeEventHandlers/onPointerDown race this
 * hook's preventDefault() works around (see the hook's own doc comment).
 * Manually confirmed both against a hand-simulated pointerdown+pointerup+click
 * sequence AND the proven atoms.tsx-derived implementation this hook now
 * shares — jsdom's synthetic PointerEvent does not reproduce Radix's real
 * internal event composition closely enough to trust either a pass or a fail
 * here (it produced a false failure against the known-good, already
 * device-verified implementation). Per code review: verify tap-to-toggle by
 * hand on a real touch device, not via a jsdom-simulated pointer sequence.
 */
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { useTapToggleTooltip } from '@/hooks/use-tap-toggle-tooltip'

function TestTrigger() {
    const { open, onOpenChange, onPointerDown, onFocus, onClick, ref } = useTapToggleTooltip<HTMLButtonElement>()
    return (
        <TooltipProvider>
            <Tooltip open={open} onOpenChange={onOpenChange}>
                <TooltipTrigger asChild>
                    <button
                        ref={ref}
                        type="button"
                        onPointerDown={onPointerDown}
                        onFocus={onFocus}
                        onClick={onClick}
                    >
                        trigger
                    </button>
                </TooltipTrigger>
                <TooltipContent>tooltip text</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

describe('[TC-F08-04-63..64] useTapToggleTooltip', () => {
    it('TC-F08-04-63: click on trigger opens the tooltip', () => {
        render(<TestTrigger />)

        expect(screen.queryAllByText('tooltip text')).toHaveLength(0)

        fireEvent.click(screen.getByRole('button', { name: 'trigger' }))

        // Radix renders a duplicate visually-hidden a11y copy alongside the
        // visible content — assert at least one is present, not exactly one.
        expect(screen.getAllByText('tooltip text').length).toBeGreaterThan(0)
    })

    it('TC-F08-04-64: pointerdown outside the trigger closes an open tooltip', () => {
        render(
            <div>
                <TestTrigger />
                <div data-testid="outside">outside</div>
            </div>,
        )

        fireEvent.click(screen.getByRole('button', { name: 'trigger' }))
        expect(screen.getAllByText('tooltip text').length).toBeGreaterThan(0)

        fireEvent.pointerDown(screen.getByTestId('outside'))
        expect(screen.queryAllByText('tooltip text')).toHaveLength(0)
    })
})
