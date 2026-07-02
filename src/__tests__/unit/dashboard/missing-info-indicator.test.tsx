/**
 * Component Render Tests — MissingInfoIndicator (GH-1457)
 * Coverage Map:
 *   TC-09.31 → Renders null when missing array is empty
 *   TC-09.32 → Renders AlertTriangle button when missing is non-empty
 *   TC-09.33 → Button has correct aria-label
 *   TC-09.34 → Tooltip shows correct missing field labels
 *   TC-09.35 → Click on button doesn't propagate to parent
 *   TC-09.36 → Icon is hidden from screen readers (aria-hidden)
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
import { MissingInfoIndicator } from '@/components/dashboard/MissingInfoIndicator'
import type { MissingField } from '@/lib/products/missing-fields'

// Helper to create mock translation object with full structure
function createMockT() {
    return {
        dashboard: {
            products: {
                list: {
                    missingInfoTitle: 'Missing information',
                    missingAlt: 'Image alt text',
                    missingCategory: 'Category',
                },
            },
        },
    } as any
}

// ──────────────────────────────────────────────────────────────────────────────
// TC-09.31: Render nothing when complete
// ──────────────────────────────────────────────────────────────────────────────
describe('[TC-09.31] MissingInfoIndicator — Empty missing array', () => {
    it('returns null when missing array is empty', () => {
        // Arrange
        const mockT = createMockT()

        // Act
        const { container } = render(<MissingInfoIndicator missing={[]} t={mockT} />)

        // Assert
        expect(container.firstChild).toBeNull()
    })
})

// ──────────────────────────────────────────────────────────────────────────────
// TC-09.32–33: Render AlertTriangle button with aria-label
// ──────────────────────────────────────────────────────────────────────────────
describe('[TC-09.32–33] MissingInfoIndicator — AlertTriangle button', () => {
    it('TC-09.32: renders button element when missing is non-empty', () => {
        // Arrange
        const missing: MissingField[] = ['alt']
        const mockT = createMockT()

        // Act
        render(<MissingInfoIndicator missing={missing} t={mockT} />)

        // Assert
        const button = screen.getByRole('button')
        expect(button).toBeInTheDocument()
    })

    it('TC-09.33: button has correct aria-label', () => {
        // Arrange
        const missing: MissingField[] = ['alt']
        const mockT = createMockT()

        // Act
        render(<MissingInfoIndicator missing={missing} t={mockT} />)

        // Assert
        const button = screen.getByRole('button')
        expect(button).toHaveAttribute('aria-label', 'Missing information')
    })

    it('renders AlertTriangle icon (text: "AlertTriangle")', () => {
        // Arrange
        const missing: MissingField[] = ['category']
        const mockT = createMockT()

        // Act
        render(<MissingInfoIndicator missing={missing} t={mockT} />)

        // Assert
        // The AlertTriangle component renders with lucide-react; check for icon in button
        const button = screen.getByRole('button')
        expect(button).toBeInTheDocument()
        // Icon should be rendered inside the button
        expect(button.querySelector('svg')).toBeInTheDocument()
    })

    it('icon is hidden from screen readers (aria-hidden="true")', () => {
        // Arrange
        const missing: MissingField[] = ['alt', 'category']
        const mockT = createMockT()

        // Act
        render(<MissingInfoIndicator missing={missing} t={mockT} />)

        // Assert
        const icon = screen.getByRole('button').querySelector('svg')
        expect(icon).toHaveAttribute('aria-hidden', 'true')
    })
})

// ──────────────────────────────────────────────────────────────────────────────
// TC-09.34: Tooltip content shows correct missing field labels
// ──────────────────────────────────────────────────────────────────────────────
describe('[TC-09.34] MissingInfoIndicator — Tooltip content', () => {
    it('shows tooltip title "Missing information"', () => {
        // Arrange
        const missing: MissingField[] = ['alt']
        const mockT = createMockT()

        // Act
        render(<MissingInfoIndicator missing={missing} t={mockT} />)

        // Assert
        expect(screen.getByText('Missing information')).toBeInTheDocument()
    })

    it('TC-09.34: shows "Image alt text" label when alt is missing', () => {
        // Arrange
        const missing: MissingField[] = ['alt']
        const mockT = createMockT()

        // Act
        render(<MissingInfoIndicator missing={missing} t={mockT} />)

        // Assert
        expect(screen.getByText('Image alt text')).toBeInTheDocument()
    })

    it('TC-09.34b: shows "Category" label when category is missing', () => {
        // Arrange
        const missing: MissingField[] = ['category']
        const mockT = createMockT()

        // Act
        render(<MissingInfoIndicator missing={missing} t={mockT} />)

        // Assert
        expect(screen.getByText('Category')).toBeInTheDocument()
    })

    it('TC-09.34c: shows both labels when both alt and category are missing', () => {
        // Arrange
        const missing: MissingField[] = ['alt', 'category']
        const mockT = createMockT()

        // Act
        render(<MissingInfoIndicator missing={missing} t={mockT} />)

        // Assert
        expect(screen.getByText('Image alt text')).toBeInTheDocument()
        expect(screen.getByText('Category')).toBeInTheDocument()
    })

    it('renders labels in a list structure', () => {
        // Arrange
        const missing: MissingField[] = ['alt', 'category']
        const mockT = createMockT()

        // Act
        render(<MissingInfoIndicator missing={missing} t={mockT} />)

        // Assert
        const listItems = screen.getAllByRole('listitem')
        expect(listItems).toHaveLength(2)
        expect(listItems[0]).toHaveTextContent('Image alt text')
        expect(listItems[1]).toHaveTextContent('Category')
    })
})

// ──────────────────────────────────────────────────────────────────────────────
// TC-09.35: stopPropagation prevents row click
// ──────────────────────────────────────────────────────────────────────────────
describe('[TC-09.35] MissingInfoIndicator — Click propagation', () => {
    it('TC-09.35: stopPropagation prevents parent click handler', () => {
        // Arrange
        const missing: MissingField[] = ['alt']
        const mockT = createMockT()
        const parentClickHandler = vi.fn()

        // Act
        const { container } = render(
            <div onClick={parentClickHandler}>
                <MissingInfoIndicator missing={missing} t={mockT} />
            </div>
        )

        // Get the button and click it
        const button = screen.getByRole('button')
        fireEvent.click(button)

        // Assert
        expect(parentClickHandler).not.toHaveBeenCalled()
    })

    it('button click is registered locally (button itself is clicked)', () => {
        // Arrange
        const missing: MissingField[] = ['alt']
        const mockT = createMockT()

        // Act
        render(<MissingInfoIndicator missing={missing} t={mockT} />)

        // Get the button
        const button = screen.getByRole('button')

        // Assert
        // Button should be clickable (no disabled state)
        expect(button).not.toBeDisabled()
    })
})

// ──────────────────────────────────────────────────────────────────────────────
// Additional coverage: button properties
// ──────────────────────────────────────────────────────────────────────────────
describe('MissingInfoIndicator — Button properties', () => {
    it('button has type="button" (not submit)', () => {
        // Arrange
        const missing: MissingField[] = ['alt']
        const mockT = createMockT()

        // Act
        render(<MissingInfoIndicator missing={missing} t={mockT} />)

        // Assert
        const button = screen.getByRole('button')
        expect(button).toHaveAttribute('type', 'button')
    })

    it('button has cursor-help class (visual indicator)', () => {
        // Arrange
        const missing: MissingField[] = ['category']
        const mockT = createMockT()

        // Act
        render(<MissingInfoIndicator missing={missing} t={mockT} />)

        // Assert
        const button = screen.getByRole('button')
        expect(button).toHaveClass('cursor-help')
    })

    it('button has shrink-0 to prevent truncation', () => {
        // Arrange
        const missing: MissingField[] = ['alt', 'category']
        const mockT = createMockT()

        // Act
        render(<MissingInfoIndicator missing={missing} t={mockT} />)

        // Assert
        const button = screen.getByRole('button')
        expect(button).toHaveClass('shrink-0')
    })
})
