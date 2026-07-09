/**
 * Component Render Tests — AiReviewIndicator (GH-1502)
 * Coverage Map:
 *   TC-F08-04-40 → Renders null when pending is falsy
 *   TC-F08-04-41 → Renders pulse dot + tooltip + aria-label when pending is true
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

beforeEach(() => {
    vi.clearAllMocks()
})

// ── Mock Tooltip components ────────────────────────────────────────────────────
vi.mock('@/components/ui/tooltip', () => {
    const TooltipTrigger = React.forwardRef<HTMLDivElement, { asChild?: boolean; children: React.ReactNode }>(
        ({ asChild, children }, ref) => {
            if (asChild && React.isValidElement(children)) {
                return React.cloneElement(children as React.ReactElement<any>, { ref } as any)
            }
            return (
                <div ref={ref} data-testid="tooltip-trigger">
                    {children}
                </div>
            )
        }
    )
    TooltipTrigger.displayName = 'TooltipTrigger'

    return {
        Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
        TooltipTrigger,
        TooltipContent: ({ children }: { children: React.ReactNode }) => (
            <div data-testid="tooltip-content">{children}</div>
        ),
    }
})

// ── Import after mocks ────────────────────────────────────────────────────────
import { AiReviewIndicator } from '@/components/dashboard/AiReviewIndicator'

function createMockT() {
    return {
        dashboard: {
            products: {
                list: {
                    aiReviewTooltip: 'Created by AI — needs review',
                    aiReviewAriaLabel: 'AI-created draft pending review',
                },
            },
        },
    } as any
}

// ──────────────────────────────────────────────────────────────────────────────
// TC-F08-04-40: Render nothing when not pending
// ──────────────────────────────────────────────────────────────────────────────
describe('[TC-F08-04-40] AiReviewIndicator — not pending', () => {
    it('returns null when pending is undefined', () => {
        const mockT = createMockT()
        const { container } = render(<AiReviewIndicator t={mockT} />)
        expect(container.firstChild).toBeNull()
    })

    it('returns null when pending is false', () => {
        const mockT = createMockT()
        const { container } = render(<AiReviewIndicator pending={false} t={mockT} />)
        expect(container.firstChild).toBeNull()
    })
})

// ──────────────────────────────────────────────────────────────────────────────
// TC-F08-04-41: Render pulse dot + tooltip + aria-label when pending
// ──────────────────────────────────────────────────────────────────────────────
describe('[TC-F08-04-41] AiReviewIndicator — pending', () => {
    it('renders a focusable button when pending is true', () => {
        const mockT = createMockT()
        render(<AiReviewIndicator pending={true} t={mockT} />)
        expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('button has the correct aria-label', () => {
        const mockT = createMockT()
        render(<AiReviewIndicator pending={true} t={mockT} />)
        expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'AI-created draft pending review')
    })

    it('shows the AI-review tooltip text', () => {
        const mockT = createMockT()
        render(<AiReviewIndicator pending={true} t={mockT} />)
        expect(screen.getByText('Created by AI — needs review')).toBeInTheDocument()
    })

    it('the dot is hidden from screen readers (aria-hidden="true")', () => {
        const mockT = createMockT()
        render(<AiReviewIndicator pending={true} t={mockT} />)
        const dot = screen.getByRole('button').querySelector('span')
        expect(dot).toHaveAttribute('aria-hidden', 'true')
    })

    it('click does not propagate to a parent handler (row stays un-clicked)', () => {
        const mockT = createMockT()
        const parentClickHandler = vi.fn()
        render(
            <div onClick={parentClickHandler}>
                <AiReviewIndicator pending={true} t={mockT} />
            </div>
        )
        fireEvent.click(screen.getByRole('button'))
        expect(parentClickHandler).not.toHaveBeenCalled()
    })
})
