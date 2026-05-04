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
