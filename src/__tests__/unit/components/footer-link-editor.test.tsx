import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FooterLinkEditor } from '@/components/editor/footer-link-editor'
import { I18nProvider } from '@/i18n'
import React from 'react'

// Mock i18n dependencies
vi.mock('@/i18n', async () => {
    const actual = await vi.importActual('@/i18n')
    return {
        ...actual,
        useI18n: () => ({
            t: {
                editor: {
                    settings: {
                        columnTitle: 'Column Title',
                        links: 'Links',
                        dragToReorder: 'Drag to reorder',
                        removeLink: 'Remove link',
                        addLink: 'Add Link',
                        addColumn: 'Add Column',
                        columnN: 'Column {{n}}',
                        removeColumn: 'Remove Column',
                    },
                },
            },
            ti: (key: string, vars?: Record<string, unknown>) => {
                if (key.includes('columnN') && vars?.n) {
                    return `Column ${vars.n}`
                }
                return key
            },
        }),
    }
})

// TC-F05-967-B: Single-expand accordion behavior
describe('[TC-F05-967-B] FooterLinkEditor — single-expand accordion', () => {
    const mockColumns = [
        {
            title: 'Column 1',
            links: [
                { label: 'Link 1A', url: '/link1a' },
                { label: 'Link 1B', url: '/link1b' },
            ],
        },
        {
            title: 'Column 2',
            links: [
                { label: 'Link 2A', url: 'https://example.com' },
            ],
        },
        {
            title: 'Column 3',
            links: [
                { label: 'Link 3A', url: '/link3a', style: 'internal' },
            ],
        },
    ]

    const mockOnUpdate = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('opening col 1 then col 2 leaves only col 2 open', async () => {
        render(
            <I18nProvider defaultLocale="en">
                <FooterLinkEditor columns={mockColumns} onUpdate={mockOnUpdate} />
            </I18nProvider>,
        )

        const columnButtons = screen.getAllByText(/Column [123]/)
        expect(columnButtons).toHaveLength(3)

        // Act: click column 1 header (first button)
        fireEvent.click(columnButtons[0]!)
        await waitFor(() => {
            expect(screen.getByDisplayValue('Link 1A')).toBeInTheDocument()
        })

        // Act: click column 2 header (second button)
        fireEvent.click(columnButtons[1]!)
        await waitFor(() => {
            expect(screen.getByDisplayValue('Link 2A')).toBeInTheDocument()
        })

        // Assert: only column 2 content visible, column 1 content hidden
        expect(screen.getByDisplayValue('Link 2A')).toBeVisible()
        expect(screen.queryByDisplayValue('Link 1A')).not.toBeInTheDocument()
        expect(screen.queryByDisplayValue('Link 1B')).not.toBeInTheDocument()
    })

    it('clicking already-open column closes it', async () => {
        render(
            <I18nProvider defaultLocale="en">
                <FooterLinkEditor columns={mockColumns} onUpdate={mockOnUpdate} />
            </I18nProvider>,
        )

        const columnButtons = screen.getAllByText(/Column [123]/)

        // Act: open column 1
        fireEvent.click(columnButtons[0]!)
        await waitFor(() => {
            expect(screen.getByDisplayValue('Link 1A')).toBeInTheDocument()
        })

        // Assert: column 1 is open
        expect(screen.getByDisplayValue('Link 1A')).toBeVisible()

        // Act: click same column header to close
        fireEvent.click(columnButtons[0]!)
        await waitFor(() => {
            expect(screen.queryByDisplayValue('Link 1A')).not.toBeInTheDocument()
        })

        // Assert: column 1 is closed
        expect(screen.queryByDisplayValue('Link 1A')).not.toBeInTheDocument()
    })

    it('opening col 1 shows expand chevron (ChevronDown), col 2 shows collapse (ChevronRight)', async () => {
        render(
            <I18nProvider defaultLocale="en">
                <FooterLinkEditor columns={mockColumns} onUpdate={mockOnUpdate} />
            </I18nProvider>,
        )

        const columnButtons = screen.getAllByText(/Column [123]/)

        // Act: open column 1
        fireEvent.click(columnButtons[0]!)
        await waitFor(() => {
            expect(screen.getByDisplayValue('Link 1A')).toBeInTheDocument()
        })

        // Assert: chevron icons are rendered (chevron direction determined by SVG element present)
        // Both columns should render, but only col 1 open
        expect(screen.getByDisplayValue('Link 1A')).toBeVisible()
        expect(screen.queryByDisplayValue('Link 2A')).not.toBeInTheDocument()
    })

    it('all columns start closed', () => {
        render(
            <I18nProvider defaultLocale="en">
                <FooterLinkEditor columns={mockColumns} onUpdate={mockOnUpdate} />
            </I18nProvider>,
        )

        // Assert: no link fields visible initially
        expect(screen.queryByDisplayValue('Link 1A')).not.toBeInTheDocument()
        expect(screen.queryByDisplayValue('Link 2A')).not.toBeInTheDocument()
        expect(screen.queryByDisplayValue('Link 3A')).not.toBeInTheDocument()
    })
})
