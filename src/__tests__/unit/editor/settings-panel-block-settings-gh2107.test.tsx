/**
 * Unit Tests — SettingsPanel Block tab UI (GH-2107)
 * TC-GH2107-01, TC-GH2107-02, TC-GH2107-05, TC-GH2107-10, TC-GH2107-11, TC-GH2107-12
 * Convention: docs/TEST_CONVENTION.md | QA: docs/qa/F05-ai-editor-testcases.md (GH-2107)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Registry still returns an emoji icon: the header must ignore it.
vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getBlockMeta: (type: string) => ({
            name: type.charAt(0).toUpperCase() + type.slice(1),
            icon: '🧩',
            variants: ['default', 'centered'],
            type,
        }),
    },
}))

import { SettingsPanel } from '@/components/editor/SettingsPanel'
import { I18nProvider } from '@/i18n'
import React from 'react'

const baseProps = {
    blockIndex: 2,
    theme: { primaryColor: '#0ea5e9', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
    onThemeChange: vi.fn(),
    onDeleteBlock: vi.fn(),
    onDuplicateBlock: vi.fn(),
    onBlockFieldChange: vi.fn(),
    onBlockUpdate: vi.fn(),
}

function renderPanel(block: Record<string, unknown>, locale: 'en' | 'ms' = 'en') {
    return render(
        <I18nProvider defaultLocale={locale}>
            <SettingsPanel {...baseProps} block={block} />
        </I18nProvider>,
    )
}

describe('SettingsPanel Block tab (GH-2107)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // jsdom lacks these (Radix Select)
        if (!window.HTMLElement.prototype.hasPointerCapture) window.HTMLElement.prototype.hasPointerCapture = () => false
        if (!window.HTMLElement.prototype.scrollIntoView) window.HTMLElement.prototype.scrollIntoView = () => {}
    })

    it('[TC-GH2107-01] header shows the lucide block icon, not the registry emoji', () => {
        // Arrange & Act
        renderPanel({ blockType: 'hero', variant: 'default' })

        // Assert
        const icon = screen.getByTestId('block-settings-icon')
        expect(icon.querySelector('svg')).toHaveClass('lucide-panel-top')
        expect(screen.queryByText(/🧩/)).not.toBeInTheDocument()
        expect(screen.getByText('Hero')).toBeInTheDocument()
    })

    it('[TC-GH2107-02] unmapped block type falls back to the shared fallback icon', () => {
        // Arrange & Act
        renderPanel({ blockType: 'testimonials', variant: 'default' })

        // Assert
        expect(screen.getByTestId('block-settings-icon').querySelector('svg')).toHaveClass('lucide-puzzle')
    })

    it('[TC-GH2107-05] block variant chips expose pressed state and change the variant', () => {
        // Arrange
        renderPanel({ blockType: 'hero', variant: 'default' })
        const centered = screen.getByRole('button', { name: 'Centered' })

        // Act
        fireEvent.click(centered)

        // Assert
        expect(screen.getByRole('button', { name: 'Default' })).toHaveAttribute('aria-pressed', 'true')
        expect(centered).toHaveAttribute('aria-pressed', 'false')
        expect(baseProps.onBlockFieldChange).toHaveBeenCalledWith(2, 'variant', 'centered')
    })

    it('[TC-GH2107-10] spacing labels are translated (ms)', () => {
        // Arrange & Act
        renderPanel({ blockType: 'hero', variant: 'default' }, 'ms')

        // Assert
        expect(screen.getByText('Susun atur & jarak')).toBeInTheDocument()
        expect(screen.getByRole('slider', { name: 'Jarak atas' })).toBeInTheDocument()
        expect(screen.getByRole('slider', { name: 'Jarak bawah' })).toBeInTheDocument()
    })

    it.each(['pricing', 'feature-comparison', 'announcement-bar'])(
        '[TC-GH2107-11] %s renders one shared spacing section and saves blockSpacing',
        (blockType) => {
            // Arrange
            renderPanel({ blockType, variant: 'default', blockSpacing: { paddingBottom: 8 } })
            const top = screen.getByRole('slider', { name: 'Top spacing' })

            // Act
            fireEvent.focus(top)
            fireEvent.change(top, { target: { value: '40' } })
            fireEvent.pointerUp(top)

            // Assert — exactly one Layout & Spacing section, existing spacing keys kept
            expect(screen.getAllByText('Layout & Spacing')).toHaveLength(1)
            expect(baseProps.onBlockUpdate).toHaveBeenCalledWith(2, { blockSpacing: { paddingBottom: 8, paddingTop: 40 } })
        },
    )

    it('[TC-GH2107-12] announcement bar without blockSpacing defaults sliders to paddingY', () => {
        // Arrange & Act
        renderPanel({ blockType: 'announcement-bar', variant: 'default', paddingY: 16 })

        // Assert
        expect(screen.getByRole('slider', { name: 'Top spacing' })).toHaveValue('16')
        expect(screen.getByRole('slider', { name: 'Bottom spacing' })).toHaveValue('16')
    })
})
