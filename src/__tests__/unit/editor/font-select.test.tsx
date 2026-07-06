import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { FontSelect } from '@/components/editor/FontSelect'

// ── Setup: Stub jsdom's missing Radix Select support ──────────────────────
// Radix Select calls hasPointerCapture and scrollIntoView which don't exist in jsdom.
beforeEach(() => {
    if (!window.HTMLElement.prototype.hasPointerCapture) {
        window.HTMLElement.prototype.hasPointerCapture = () => false
    }
    if (!window.HTMLElement.prototype.scrollIntoView) {
        window.HTMLElement.prototype.scrollIntoView = () => {}
    }
})

describe('FontSelect', () => {
    // ── Desktop/Tablet branch (≥768px) ───────────────────────────────────

    describe('Desktop branch (≥768px) — Radix Select', () => {
        it('renders SelectTrigger with current value', () => {
            // Arrange
            const mockOnChange = vi.fn()
            const options = ['Inter', 'Outfit', 'Playfair Display']

            // Act
            render(
                <FontSelect
                    value="Outfit"
                    onChange={mockOnChange}
                    role="heading"
                    label="Heading Font"
                    options={options}
                />
            )

            // Assert — the trigger button displays the current font value
            const triggerButton = screen.getByRole('combobox')
            expect(triggerButton).toBeInTheDocument()
            expect(triggerButton.textContent).toContain('Outfit')
        })

        it('opening the select displays all options as role=option', async () => {
            // Arrange
            const mockOnChange = vi.fn()
            const options = ['Inter', 'Outfit', 'Playfair Display']
            render(
                <FontSelect
                    value="Outfit"
                    onChange={mockOnChange}
                    role="heading"
                    label="Heading Font"
                    options={options}
                />
            )

            // Act — click trigger to open
            const triggerButton = screen.getByRole('combobox')
            fireEvent.click(triggerButton)

            // Assert — all options are rendered in the portal with role=option
            await waitFor(() => {
                options.forEach(font => {
                    const option = screen.getByRole('option', { name: new RegExp(font, 'i') })
                    expect(option).toBeInTheDocument()
                })
            })
        })

        it('clicking an option calls onChange with the font name', async () => {
            // Arrange
            const mockOnChange = vi.fn()
            const options = ['Inter', 'Outfit', 'Playfair Display']
            render(
                <FontSelect
                    value="Outfit"
                    onChange={mockOnChange}
                    role="heading"
                    label="Heading Font"
                    options={options}
                />
            )

            // Act — open and select "Playfair Display"
            const triggerButton = screen.getByRole('combobox')
            fireEvent.click(triggerButton)

            await waitFor(() => {
                const option = screen.getByRole('option', { name: /Playfair Display/i })
                expect(option).toBeInTheDocument()
            })
            const option = screen.getByRole('option', { name: /Playfair Display/i })
            fireEvent.click(option)

            // Assert
            expect(mockOnChange).toHaveBeenCalledWith('Playfair Display')
        })

        it('trigger button is styled with fontFamily CSS var', () => {
            // Arrange
            const mockOnChange = vi.fn()
            const options = ['Inter', 'Outfit']
            render(
                <FontSelect
                    value="Inter"
                    onChange={mockOnChange}
                    role="body"
                    label="Body Font"
                    options={options}
                />
            )

            // Assert — trigger button has inline font-family style
            const triggerButton = screen.getByRole('combobox')
            // The fontFamily is set via inline style attribute
            expect(triggerButton.getAttribute('style')).toMatch(/font-family/i)
            expect(triggerButton.getAttribute('style')).toContain('Inter')
        })
    })

    // ── Mobile branch (<768px) ───────────────────────────────────────────

    describe('Mobile branch (<768px) — bottom sheet', () => {
        beforeEach(() => {
            // Mock window.matchMedia to return true for (max-width: 767px)
            // This forces the component to render the mobile bottom sheet branch
            window.matchMedia = vi.fn((query: string) => ({
                matches: query === '(max-width: 767px)',
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })) as any
        })

        it('renders a trigger button showing current value', () => {
            // Arrange
            const mockOnChange = vi.fn()
            const options = ['DM Sans', 'Inter', 'Outfit']

            // Act
            render(
                <FontSelect
                    value="DM Sans"
                    onChange={mockOnChange}
                    role="body"
                    label="Body Font"
                    options={options}
                />
            )

            // Assert — the button trigger exists and shows the current value
            const triggerButton = screen.getByRole('button')
            expect(triggerButton).toBeInTheDocument()
            expect(triggerButton.textContent).toContain('DM Sans')
        })

        it('clicking trigger button opens the bottom sheet', async () => {
            // Arrange
            const mockOnChange = vi.fn()
            const options = ['DM Sans', 'Inter', 'Outfit']
            render(
                <FontSelect
                    value="DM Sans"
                    onChange={mockOnChange}
                    role="body"
                    label="Body Font"
                    options={options}
                />
            )

            // Act — click the trigger button
            const triggerButton = screen.getByRole('button')
            fireEvent.click(triggerButton)

            // Assert — bottom sheet opens
            await waitFor(() => {
                // The sheet label appears in the header
                expect(screen.getByText('Body Font')).toBeInTheDocument()
                // The backdrop (with close handler) appears
                const backdrop = screen.getByLabelText('Close font picker')
                expect(backdrop).toBeInTheDocument()
            })
        })

        it('clicking a font option calls onChange and closes the sheet', async () => {
            // Arrange
            const mockOnChange = vi.fn()
            const options = ['DM Sans', 'Inter', 'Outfit']
            render(
                <FontSelect
                    value="DM Sans"
                    onChange={mockOnChange}
                    role="body"
                    label="Body Font"
                    options={options}
                />
            )

            // Act — open sheet
            const triggerButton = screen.getByRole('button', { name: /DM Sans/i })
            fireEvent.click(triggerButton)

            // Wait for options to appear
            await waitFor(() => {
                const outfitButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('Outfit'))
                expect(outfitButton).toBeInTheDocument()
            })

            // Click the "Outfit" option
            const outfitButtons = screen.getAllByRole('button').filter(btn => btn.textContent?.includes('Outfit') && btn !== triggerButton)
            expect(outfitButtons.length).toBeGreaterThan(0)
            fireEvent.click(outfitButtons[0])

            // Assert
            expect(mockOnChange).toHaveBeenCalledWith('Outfit')
            // Sheet should close (label no longer visible)
            await waitFor(() => {
                // The sheet's label should not be in the document
                expect(screen.queryByText('Body Font')).not.toBeInTheDocument()
            }, { timeout: 500 })
        })

        it('closing backdrop closes the sheet', async () => {
            // Arrange
            const mockOnChange = vi.fn()
            const options = ['Inter', 'Outfit']
            render(
                <FontSelect
                    value="Outfit"
                    onChange={mockOnChange}
                    role="heading"
                    label="Heading Font"
                    options={options}
                />
            )

            // Act — open sheet
            const triggerButton = screen.getByRole('button')
            fireEvent.click(triggerButton)

            // Wait for sheet to open
            await waitFor(() => {
                expect(screen.getByText('Heading Font')).toBeInTheDocument()
            })

            // Click the backdrop
            const backdrop = screen.getByLabelText('Close font picker')
            fireEvent.click(backdrop)

            // Assert — sheet closes
            await waitFor(() => {
                expect(screen.queryByText('Heading Font')).not.toBeInTheDocument()
            }, { timeout: 500 })

            // onChange was not called
            expect(mockOnChange).not.toHaveBeenCalled()
        })

        it('mobile sheet renders CheckIcon for selected option', async () => {
            // Arrange
            const mockOnChange = vi.fn()
            const options = ['Inter', 'Outfit', 'Playfair Display']
            render(
                <FontSelect
                    value="Outfit"
                    onChange={mockOnChange}
                    role="heading"
                    label="Heading Font"
                    options={options}
                />
            )

            // Act — open sheet
            const triggerButton = screen.getByRole('button')
            fireEvent.click(triggerButton)

            // Assert — the currently selected option ("Outfit") should have a check icon visible
            await waitFor(() => {
                // The selected item has a check icon rendered inside it
                const outfitButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('Outfit') && btn !== triggerButton)
                expect(outfitButton).toBeInTheDocument()
                // Check that it has the SVG (Check icon)
                const svg = outfitButton?.querySelector('svg')
                expect(svg).toBeInTheDocument()
            })
        })
    })

    // ── Resilience: No window.matchMedia ──────────────────────────────────

    describe('Resilience when window.matchMedia is undefined', () => {
        it('degrades to desktop branch when window.matchMedia is undefined', () => {
            // Arrange — simulate environment where window.matchMedia is not available
            const originalMatchMedia = window.matchMedia
            delete (window as any).matchMedia

            try {
                const mockOnChange = vi.fn()
                const options = ['Inter', 'Outfit']

                // Act
                render(
                    <FontSelect
                        value="Outfit"
                        onChange={mockOnChange}
                        role="heading"
                        label="Heading Font"
                        options={options}
                    />
                )

                // Assert — should render Radix Select (desktop branch), not crash
                const trigger = screen.getByRole('combobox')
                expect(trigger).toBeInTheDocument()
                expect(trigger.textContent).toContain('Outfit')
            } finally {
                // Restore
                window.matchMedia = originalMatchMedia
            }
        })
    })
})
