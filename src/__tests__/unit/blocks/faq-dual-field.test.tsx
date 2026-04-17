/**
 * Unit Tests: FAQ block dual-field fallback (faqs vs items)
 * TC-ID: TC-F01-FAQ-DUAL — Payload schema uses 'faqs', frontend config uses 'items'
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FAQBlock } from '@/blocks/faq/index'

// Mock framer-motion with all exports used by FAQ block
vi.mock('framer-motion', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>
    return {
        ...actual,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
        motion: {
            div: ({ children, ...props }: Record<string, unknown>) => {
                const { initial, animate, exit, variants, transition, whileInView, viewport, ...rest } = props
                return <div {...rest}>{children as React.ReactNode}</div>
            },
            section: ({ children, ...props }: Record<string, unknown>) => {
                const { initial, animate, exit, variants, transition, whileInView, viewport, ...rest } = props
                return <section {...rest}>{children as React.ReactNode}</section>
            },
        },
    }
})

describe('[TC-F01-FAQ-DUAL] FAQ block dual-field fallback', () => {
    it('TC-F01-FAQ-DUAL-01 — renders items from "items" field (frontend config)', () => {
        // Arrange
        const block = {
            blockType: 'faq' as const,
            items: [
                { question: 'What is this?', answer: 'A test.' },
                { question: 'How does it work?', answer: 'Magic.' },
            ],
        }

        // Act
        render(<FAQBlock block={block} />)

        // Assert
        expect(screen.getByText('What is this?')).toBeInTheDocument()
        expect(screen.getByText('How does it work?')).toBeInTheDocument()
    })

    it('TC-F01-FAQ-DUAL-02 — renders items from "faqs" field (Payload schema)', () => {
        // Arrange — AI returns changes with "faqs" field name
        const block = {
            blockType: 'faq' as const,
            items: [],
            faqs: [
                { question: 'FAQ from Payload?', answer: 'Yes.' },
                { question: 'Another one?', answer: 'Sure.' },
            ],
        } as Record<string, unknown>

        // Act
        render(<FAQBlock block={block as any} />)

        // Assert
        expect(screen.getByText('FAQ from Payload?')).toBeInTheDocument()
        expect(screen.getByText('Another one?')).toBeInTheDocument()
    })

    it('TC-F01-FAQ-DUAL-03 — "faqs" takes priority over empty "items"', () => {
        // Arrange
        const block = {
            blockType: 'faq' as const,
            items: [],
            faqs: [{ question: 'Priority test', answer: 'faqs wins.' }],
        } as Record<string, unknown>

        // Act
        render(<FAQBlock block={block as any} />)

        // Assert
        expect(screen.getByText('Priority test')).toBeInTheDocument()
    })

    it('TC-F01-FAQ-DUAL-04 — renders FALLBACK_FAQ_ITEMS when both fields are empty/missing', () => {
        // Arrange — empty input path. Source now substitutes FALLBACK_FAQ_ITEMS
        // (generic starter FAQs) so admin/editor never sees a blank FAQ block.
        // See src/blocks/faq/index.tsx:14,239.
        const block = {
            blockType: 'faq' as const,
            items: [],
        }

        // Act
        const { container } = render(<FAQBlock block={block} />)

        // Assert — fallback renders at least 1 accordion question button.
        const buttons = container.querySelectorAll('button')
        expect(buttons.length).toBeGreaterThan(0)
    })

    it('TC-F01-FAQ-DUAL-05 — non-array "faqs" value falls through to "items" (C2 unsafe-cast guard)', () => {
        // Arrange — AI/stale state sends a non-array scalar for `faqs`.
        // Before the Array.isArray() guard, this would cast as FAQItem[] and
        // FAQBlock would try to render a string as an item list → crash / garbage.
        const block = {
            blockType: 'faq' as const,
            faqs: 'not-an-array',
            items: [{ question: 'Safe fallback Q', answer: 'Safe fallback A' }],
        } as unknown as Parameters<typeof FAQBlock>[0]['block']

        // Act
        render(<FAQBlock block={block} />)

        // Assert — fell through to `items`, rendered safely
        expect(screen.getByText('Safe fallback Q')).toBeInTheDocument()
    })
})
