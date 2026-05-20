/**
 * Unit Tests — SettingsPanel nav CTA button editor
 * TC-NAV-09, TC-NAV-10
 * Convention: docs/TEST_CONVENTION.md | QA: docs/qa/F-navigation.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getBlockMeta: (type: string) => ({
            name: type.charAt(0).toUpperCase() + type.slice(1),
            icon: '🧩',
            variants: ['default'],
            type,
        }),
    },
}))

import { SettingsPanel } from '@/components/editor/SettingsPanel'
import { I18nProvider } from '@/i18n'
import React from 'react'

const mockTheme = { primaryColor: '#0ea5e9', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' }

const baseProps = {
    block: null,
    blockIndex: null,
    theme: mockTheme,
    siteName: 'Test Site',
    siteStatus: 'draft',
    onThemeChange: vi.fn(),
    onDeleteBlock: vi.fn(),
    onDuplicateBlock: vi.fn(),
    onBlockFieldChange: vi.fn(),
    onBlockUpdate: vi.fn(),
}

// ── TC-NAV-09: CTA show toggle merges default ctaButton on first enable ───────

describe('TC-NAV-09 — CTA show checkbox calls onHeaderUpdate with merged ctaButton', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('uses default ctaButton shape when no ctaButton exists and checkbox is ticked', () => {
        // Arrange
        const onHeaderUpdate = vi.fn()

        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    headerBlock={{ blockType: 'navigation', links: [] }}
                    onHeaderUpdate={onHeaderUpdate}
                    requestedTab={{ tab: 'menu', key: 1 }}
                />
            </I18nProvider>,
        )

        const checkbox = screen.getByRole('checkbox')

        // Act
        fireEvent.click(checkbox)

        // Assert
        expect(onHeaderUpdate).toHaveBeenCalledWith({
            ctaButton: expect.objectContaining({ show: true }),
        })
        // Default label and url are seeded from the fallback shape
        const calledWith = onHeaderUpdate.mock.calls[0][0] as { ctaButton: Record<string, unknown> }
        expect(calledWith.ctaButton.label).toBeDefined()
        expect(calledWith.ctaButton.url).toBeDefined()
    })

    it('preserves existing ctaButton fields when toggling show', () => {
        // Arrange
        const onHeaderUpdate = vi.fn()
        const existingCta = { show: true, label: 'Buy Now', url: '/buy' }

        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    headerBlock={{ blockType: 'navigation', ctaButton: existingCta, links: [] }}
                    onHeaderUpdate={onHeaderUpdate}
                    requestedTab={{ tab: 'menu', key: 1 }}
                />
            </I18nProvider>,
        )

        const checkbox = screen.getByRole('checkbox')

        // Act — uncheck (show: true → false)
        fireEvent.click(checkbox)

        // Assert — other fields preserved
        expect(onHeaderUpdate).toHaveBeenCalledWith({
            ctaButton: { show: false, label: 'Buy Now', url: '/buy' },
        })
    })
})

// ── TC-NAV-10: CTA label/url onBlur merges with existing ctaButton ────────────

describe('TC-NAV-10 — CTA label and url onBlur calls onHeaderUpdate with merged ctaButton', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('merges updated label while preserving show and url', () => {
        // Arrange
        const onHeaderUpdate = vi.fn()
        const existingCta = { show: true, label: 'Get started', url: '/contact' }

        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    headerBlock={{ blockType: 'navigation', ctaButton: existingCta, links: [] }}
                    onHeaderUpdate={onHeaderUpdate}
                    requestedTab={{ tab: 'menu', key: 1 }}
                />
            </I18nProvider>,
        )

        const labelInput = screen.getByPlaceholderText('Button label (e.g. Get started)')

        // Act
        fireEvent.blur(labelInput, { target: { value: 'Sign Up' } })

        // Assert
        expect(onHeaderUpdate).toHaveBeenCalledWith({
            ctaButton: { show: true, label: 'Sign Up', url: '/contact' },
        })
    })

    it('merges updated url while preserving show and label', () => {
        // Arrange
        const onHeaderUpdate = vi.fn()
        const existingCta = { show: true, label: 'Get started', url: '/contact' }

        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    headerBlock={{ blockType: 'navigation', ctaButton: existingCta, links: [] }}
                    onHeaderUpdate={onHeaderUpdate}
                    requestedTab={{ tab: 'menu', key: 1 }}
                />
            </I18nProvider>,
        )

        const urlInput = screen.getByPlaceholderText('Button URL (e.g. /contact)')

        // Act
        fireEvent.blur(urlInput, { target: { value: '/signup' } })

        // Assert
        expect(onHeaderUpdate).toHaveBeenCalledWith({
            ctaButton: { show: true, label: 'Get started', url: '/signup' },
        })
    })
})

// ── TC-F05-15-01: Hero Add Button visible when ctaButtons empty ──────────

describe('TC-F05-15-01 — Hero CTA section renders with Add Button when ctaButtons empty', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('renders + Add Button when ctaButtons is empty array', () => {
        // Arrange
        const onBlockUpdate = vi.fn()

        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    block={{ blockType: 'hero', headline: 'Test Hero', ctaButtons: [] }}
                    blockIndex={0}
                    onBlockUpdate={onBlockUpdate}
                    requestedTab={{ tab: 'block', key: 1 }}
                />
            </I18nProvider>,
        )

        // Act & Assert
        const addButton = screen.getByRole('button', { name: /\+ Add Button/i })
        expect(addButton).toBeInTheDocument()
        expect(addButton).not.toBeDisabled()
    })
})

// ── TC-F05-15-02: Hero empty state text shown when no buttons ────────────

describe('TC-F05-15-02 — Hero CTA section shows empty state text when ctaButtons empty', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('displays "No buttons yet" text when ctaButtons is empty', () => {
        // Arrange
        const onBlockUpdate = vi.fn()

        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    block={{ blockType: 'hero', headline: 'Test Hero', ctaButtons: [] }}
                    blockIndex={0}
                    onBlockUpdate={onBlockUpdate}
                    requestedTab={{ tab: 'block', key: 1 }}
                />
            </I18nProvider>,
        )

        // Act & Assert
        const emptyText = screen.getByText('No buttons yet')
        expect(emptyText).toBeInTheDocument()
    })
})

// ── TC-F05-15-03: Hero Add Button disabled when 2 buttons ───────────────

describe('TC-F05-15-03 — Hero Add Button is disabled when 2 buttons present', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('disables + Add Button when ctaButtons has 2 items', () => {
        // Arrange
        const onBlockUpdate = vi.fn()
        const ctaButtons = [
            { label: 'Button A', url: '/a' },
            { label: 'Button B', url: '/b' },
        ]

        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    block={{ blockType: 'hero', headline: 'Test Hero', ctaButtons }}
                    blockIndex={0}
                    onBlockUpdate={onBlockUpdate}
                    requestedTab={{ tab: 'block', key: 1 }}
                />
            </I18nProvider>,
        )

        // Act & Assert
        const addButton = screen.getByRole('button', { name: /\+ Add Button/i })
        expect(addButton).toBeDisabled()
    })
})

// ── TC-F05-15-04: Hero clicking Add Button calls onBlockUpdate ──────────

describe('TC-F05-15-04 — Clicking Hero Add Button calls onBlockUpdate with new button', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('calls onBlockUpdate with new button appended when Add Button clicked', () => {
        // Arrange
        const onBlockUpdate = vi.fn()
        const existingCta = { label: 'Existing', url: '/existing' }

        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    block={{ blockType: 'hero', headline: 'Test Hero', ctaButtons: [existingCta] }}
                    blockIndex={0}
                    onBlockUpdate={onBlockUpdate}
                    requestedTab={{ tab: 'block', key: 1 }}
                />
            </I18nProvider>,
        )

        const addButton = screen.getByRole('button', { name: /\+ Add Button/i })

        // Act
        fireEvent.click(addButton)

        // Assert
        expect(onBlockUpdate).toHaveBeenCalledWith(
            0,
            expect.objectContaining({
                ctaButtons: expect.arrayContaining([
                    existingCta,
                    { label: 'New Button', url: '#', style: 'primary' },
                ]),
            }),
        )
    })
})

// ── TC-F05-15-05: CTA block shows Add secondary button when falsy ───────

describe('TC-F05-15-05 — CTA block shows Add secondary button when secondaryCtaLabel falsy', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('renders Add Secondary Button when secondaryCtaLabel is undefined', () => {
        // Arrange
        const onBlockUpdate = vi.fn()

        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    block={{
                        blockType: 'cta',
                        headline: 'Test CTA',
                        ctaLabel: 'Get Started',
                        ctaUrl: '/start',
                    }}
                    blockIndex={0}
                    onBlockUpdate={onBlockUpdate}
                    requestedTab={{ tab: 'block', key: 1 }}
                />
            </I18nProvider>,
        )

        // Act & Assert
        expect(screen.getByText('Secondary Button')).toBeInTheDocument()
        const addSecondaryBtn = screen.getByRole('button', { name: /\+ Add Button/i })
        expect(addSecondaryBtn).toBeInTheDocument()
    })
})

// ── TC-F05-15-06: CTA block shows Remove; click calls onBlockUpdate ─────

describe('TC-F05-15-06 — CTA block shows Remove button; click clears secondaryCtaLabel', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('renders Remove button and calls onBlockUpdate with empty strings when clicked', () => {
        // Arrange
        const onBlockUpdate = vi.fn()

        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    block={{
                        blockType: 'cta',
                        headline: 'Test CTA',
                        ctaLabel: 'Get Started',
                        ctaUrl: '/start',
                        secondaryCtaLabel: 'Learn More',
                        secondaryCtaUrl: '/learn',
                    }}
                    blockIndex={0}
                    onBlockUpdate={onBlockUpdate}
                    requestedTab={{ tab: 'block', key: 1 }}
                />
            </I18nProvider>,
        )

        // Act & Assert — check Remove button exists
        const removeBtn = screen.getByRole('button', { name: /Remove secondary/i })
        expect(removeBtn).toBeInTheDocument()

        // Act — click Remove
        fireEvent.click(removeBtn)

        // Assert — onBlockUpdate called with cleared secondary fields
        expect(onBlockUpdate).toHaveBeenCalledWith(
            0,
            expect.objectContaining({
                secondaryCtaLabel: '',
                secondaryCtaUrl: '',
            }),
        )
    })
})

// ── TC-F05-15-07: CTA secondary Add button shows when secondaryCtaLabel is empty string ──

describe('TC-F05-15-07 — CTA secondary section shows Add button when secondaryCtaLabel is empty string', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('renders Add button when secondaryCtaLabel is empty string (post-remove state)', () => {
        // Arrange — simulates state after user removed secondary CTA (set to '')
        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    block={{ blockType: 'cta', headline: 'Test', ctaLabel: 'Get Started', ctaUrl: '/start', secondaryCtaLabel: '', secondaryCtaUrl: '' }}
                    blockIndex={0}
                    onBlockUpdate={vi.fn()}
                    requestedTab={{ tab: 'block', key: 1 }}
                />
            </I18nProvider>,
        )

        // Assert — empty string is falsy, should show Add button not Remove
        const addBtn = screen.getByRole('button', { name: /\+ Add Button/i })
        expect(addBtn).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Remove secondary/i })).not.toBeInTheDocument()
    })
})
