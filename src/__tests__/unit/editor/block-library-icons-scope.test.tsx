// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { I18nProvider } from '@/i18n'
import { BlockLibraryPanel } from '@/components/editor/BlockLibraryPanel'

// Emoji / pictographic code points — the library draws lucide icons, not emoji.
const EMOJI = /\p{Extended_Pictographic}/u

describe('[TC-F05-08-01] Block Library — lucide icons and scope badge', () => {
    const renderPanel = () =>
        render(
            <I18nProvider defaultLocale="en">
                <BlockLibraryPanel blocks={[]} selectedBlock={null} onBlockSelect={vi.fn()} onAIAction={vi.fn()} />
            </I18nProvider>,
        )

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F05-08-01: group headers and block cards show icon badges, no emoji', () => {
        // Arrange + Act
        const { container } = renderPanel()

        // Assert
        expect(screen.getByRole('button', { name: /Basics/ }).querySelector('svg')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Hero/ }).querySelector('svg')).toBeInTheDocument()
        expect(container.textContent).not.toMatch(EMOJI)
    })

    it('TC-F05-08-01: labels and order are unchanged', () => {
        // Arrange + Act
        renderPanel()

        // Assert
        const groups = screen.getAllByRole('button', { expanded: false }).concat(screen.getAllByRole('button', { expanded: true }))
        expect(groups.map(g => g.textContent?.replace(/\d+$/, ''))).toEqual(
            expect.arrayContaining(['Basics', 'Content', 'Media', 'Business', 'Commerce', 'Form & contact', 'Widgets', 'Layout']),
        )
        const cards = screen.getAllByRole('button').filter(b => b.getAttribute('draggable') === 'true')
        expect(cards.map(c => c.querySelector('p')?.textContent)).toEqual(['Hero', 'Features', 'About', 'CTA', 'Service cards'])
    })

    it('TC-F05-08-01: page blocks carry no "This page only" badge; shared blocks keep the Global badge', () => {
        // Arrange
        renderPanel()

        // Assert — Basics holds page-scoped blocks only
        expect(screen.queryByText('This page only')).not.toBeInTheDocument()
        expect(screen.queryByText('Global')).not.toBeInTheDocument()

        // Act — open Widgets, which holds the shared social widget
        fireEvent.click(screen.getByRole('button', { name: /Widgets/ }))

        // Assert
        expect(screen.queryByText('This page only')).not.toBeInTheDocument()
        expect(screen.getAllByText('Global').length).toBeGreaterThan(0)
    })
})
