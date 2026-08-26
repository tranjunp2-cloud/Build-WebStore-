/**
 * Unit Tests — SettingsPanel nav variant picker
 * TC-NAV-06, TC-NAV-07, TC-NAV-08
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

// ── TC-NAV-06: 5 variant buttons render in menu tab (mega soft-deprecated) ────

describe('TC-NAV-06 — SettingsPanel menu tab renders 5 nav variant buttons', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('shows all 5 variant labels after switching to menu tab', () => {
        // Arrange
        const onHeaderUpdate = vi.fn()

        // Act
        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    headerBlock={{ blockType: 'navigation', variant: 'default', links: [] }}
                    onHeaderUpdate={onHeaderUpdate}
                    requestedTab={{ tab: 'menu', key: 1 }}
                />
            </I18nProvider>,
        )

        // Assert — mega is soft-deprecated and no longer shown in UI (issue #1237)
        expect(screen.getByRole('button', { name: 'Default' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Centered' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Transparent' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Sidebar' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Floating' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Mega' })).not.toBeInTheDocument()
    })
})

// ── TC-NAV-07: Clicking variant button calls onHeaderUpdate({ variant }) ──────

describe('TC-NAV-07 — clicking variant button calls onHeaderUpdate with variant key', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it.each([
        ['Default', 'default'],
        ['Centered', 'centered'],
        ['Transparent', 'transparent'],
        ['Sidebar', 'sidebar'],
        ['Floating', 'floating'],
    ] as const)('clicking "%s" calls onHeaderUpdate({ variant: "%s" })', (label, key) => {
        // Arrange
        const onHeaderUpdate = vi.fn()

        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    headerBlock={{ blockType: 'navigation', variant: 'default', links: [] }}
                    onHeaderUpdate={onHeaderUpdate}
                    requestedTab={{ tab: 'menu', key: 1 }}
                />
            </I18nProvider>,
        )

        // Act
        fireEvent.click(screen.getByRole('button', { name: label }))

        // Assert
        expect(onHeaderUpdate).toHaveBeenCalledWith({ variant: key })
    })
})

// ── TC-NAV-08: Active state reflects headerBlock.variant ─────────────────────

describe('TC-NAV-08 — active variant button reflects headerBlock.variant', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('highlights the button matching headerBlock.variant', () => {
        // Arrange
        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    headerBlock={{ blockType: 'navigation', variant: 'centered', links: [] }}
                    onHeaderUpdate={vi.fn()}
                    requestedTab={{ tab: 'menu', key: 1 }}
                />
            </I18nProvider>,
        )

        // Assert — active button has the blue tint class
        const centeredBtn = screen.getByRole('button', { name: 'Centered' })
        expect(centeredBtn.className).toContain('bg-blue-500/10')

        const defaultBtn = screen.getByRole('button', { name: 'Default' })
        expect(defaultBtn.className).not.toContain('bg-blue-500/10')
    })

    it('defaults "Default" button to active when variant is undefined', () => {
        // Arrange
        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...baseProps}
                    headerBlock={{ blockType: 'navigation', links: [] }}
                    onHeaderUpdate={vi.fn()}
                    requestedTab={{ tab: 'menu', key: 1 }}
                />
            </I18nProvider>,
        )

        // Assert
        const defaultBtn = screen.getByRole('button', { name: 'Default' })
        expect(defaultBtn.className).toContain('bg-blue-500/10')
    })
})
