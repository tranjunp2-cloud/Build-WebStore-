/**
 * Unit Tests: Contact form React key uniqueness
 * TC-ID: TC-F01-CONTACT-KEYS — duplicate fieldName must not trigger React key collision
 * Convention: docs/TEST_CONVENTION.md
 *
 * Guards against the bug where `formFields.map` used `key={fieldName}`:
 * two fields sharing the same fieldName (e.g., both named "field") produced
 * "Encountered two children with the same key" in the editor.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContactBlock } from '@/blocks/contact/index'

vi.mock('framer-motion', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>
    return {
        ...actual,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
        motion: new Proxy({}, {
            get: (_t, prop: string) => ({ children, ...props }: Record<string, unknown>) => {
                const { initial, animate, exit, variants, transition, whileHover, whileTap, whileInView, viewport, ...rest } = props
                const Tag = prop as keyof JSX.IntrinsicElements
                return <Tag {...rest}>{children as React.ReactNode}</Tag>
            },
        }),
    }
})

vi.mock('@/blocks/contact/useContactForm', () => ({
    useContactForm: () => ({
        state: 'idle',
        errors: {},
        submitError: null,
        handleSubmit: (e: { preventDefault: () => void }) => e.preventDefault(),
        reset: () => {},
    }),
}))

describe('[TC-F01-CONTACT-KEYS] Contact form map key uniqueness', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        errorSpy.mockRestore()
    })

    it('TC-F01-CONTACT-KEYS-01 — two fields with duplicate fieldName render without React key warning', () => {
        // Arrange — exact shape from the editor bug report: both fields fall through
        // to fieldType default 'field', producing identical map keys under the old code.
        const block = {
            blockType: 'contact' as const,
            variant: 'form' as const,
            formFields: [
                { fieldName: 'field', label: 'First', required: false },
                { fieldName: 'field', label: 'Second', required: false },
            ],
        } as unknown as Parameters<typeof ContactBlock>[0]['block']

        // Act
        render(<ContactBlock block={block} />)

        // Assert — both labels present (map rendered both items)
        expect(screen.getByText('First')).toBeInTheDocument()
        expect(screen.getByText('Second')).toBeInTheDocument()

        // Assert — React did NOT warn about duplicate keys
        const keyWarnings = errorSpy.mock.calls.filter(call =>
            String(call[0] || '').includes('same key'),
        )
        expect(keyWarnings).toHaveLength(0)
    })

    it('TC-F01-CONTACT-KEYS-02 — fields missing fieldName + fieldType still get unique keys via index fallback', () => {
        // Arrange — all three fall through to `field-${i}` in the name derivation,
        // but the key prefix `${i}-` guarantees uniqueness regardless.
        const block = {
            blockType: 'contact' as const,
            variant: 'form' as const,
            formFields: [
                { label: 'Alpha', required: false },
                { label: 'Beta', required: false },
                { label: 'Gamma', required: false },
            ],
        } as unknown as Parameters<typeof ContactBlock>[0]['block']

        // Act
        render(<ContactBlock block={block} />)

        // Assert
        expect(screen.getByText('Alpha')).toBeInTheDocument()
        expect(screen.getByText('Beta')).toBeInTheDocument()
        expect(screen.getByText('Gamma')).toBeInTheDocument()

        const keyWarnings = errorSpy.mock.calls.filter(call =>
            String(call[0] || '').includes('same key'),
        )
        expect(keyWarnings).toHaveLength(0)
    })
})
