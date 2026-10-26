// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { I18nProvider } from '@/i18n'
import { BlockLibraryPanel } from '@/components/editor/BlockLibraryPanel'

// Emoji / pictographic code points — the library must draw icons, not emoji.
const EMOJI = /\p{Extended_Pictographic}/u

describe('[TC-F05-08-01] Block Library — icons and scope badge', () => {
    const renderPanel = () =>
        render(
            <I18nProvider defaultLocale="en">
                <BlockLibraryPanel blocks={[]} selectedBlock={null} onBlockSelect={vi.fn()} onAIAction={vi.fn()} />
            </I18nProvider>,
        )

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F05-08-01: categories and blocks use icons, with no emoji in the panel', () => {
        // Arrange + Act
        const { container } = renderPanel()

        // Assert
        const basics = screen.getByRole('button', { name: /Basics/ })
        expect(basics.querySelector('svg')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Hero/ }).querySelector('svg')).toBeInTheDocument()
        expect(container.textContent).not.toMatch(EMOJI)
    })

    it('TC-F05-08-01: page blocks carry no scope badge; shared blocks show one', () => {
        // Arrange
        renderPanel()

        // Assert — Basics (page-scoped blocks only) shows no badge at all
        expect(screen.queryByText('This page only')).not.toBeInTheDocument()
        expect(screen.queryByText('Global')).not.toBeInTheDocument()

        // Act — open Widgets, which holds the shared social widget
        fireEvent.click(screen.getByRole('button', { name: /Widgets/ }))

        // Assert
        expect(screen.getAllByText('Global')).toHaveLength(1)
    })
})
