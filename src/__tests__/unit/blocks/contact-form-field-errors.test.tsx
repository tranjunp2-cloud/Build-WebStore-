/**
 * Unit Tests: Contact form clears a field's error once the value is valid (GH-2165)
 * TC-ID: TC-F01-CONTACT-ERR-01..04
 * Convention: docs/TEST_CONVENTION.md
 *
 * Uses the REAL useContactForm hook: errors are raised on submit only and, before the fix,
 * stayed red after the visitor corrected the field.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

// Default fields: name, email, message required; phone optional. siteId present so submit validates.
const renderForm = () => {
    const block = { blockType: 'contact' as const, variant: 'form' as const, formFields: [] } as unknown as Parameters<typeof ContactBlock>[0]['block']
    const site = { id: 1 } as unknown as Parameters<typeof ContactBlock>[0]['site']
    const utils = render(<ContactBlock block={block} site={site} />)
    const submit = () => fireEvent.submit(utils.container.querySelector('form') as HTMLFormElement)
    const type = (name: string, value: string) =>
        fireEvent.change(utils.container.querySelector(`[name="${name}"]`) as HTMLInputElement, { target: { value } })
    return { submit, type }
}

describe('[TC-F01-CONTACT-ERR] Contact form per-field error clearing', () => {
    it('TC-F01-CONTACT-ERR-01 — empty submit shows 3 required errors; fixing a field clears only that error', () => {
        const { submit, type } = renderForm()
        submit()
        expect(screen.getAllByRole('alert').map((a) => a.textContent).sort()).toEqual([
            'Email is required', 'Message is required', 'Name is required',
        ])

        type('name', 'Ann')

        expect(screen.queryByText('Name is required')).not.toBeInTheDocument()
        expect(screen.getByText('Email is required')).toBeInTheDocument()
        expect(screen.getByText('Message is required')).toBeInTheDocument()
    })

    it('TC-F01-CONTACT-ERR-02 — all three filled validly → no error left (the QC scenario)', () => {
        const { submit, type } = renderForm()
        submit()

        type('name', 'Ann')
        type('email', 'ann@example.com')
        type('message', 'Hello there')

        expect(screen.queryAllByRole('alert')).toHaveLength(0)
    })

    it('TC-F01-CONTACT-ERR-03 — still-invalid value keeps an error (message refreshed), valid value clears it', () => {
        const { submit, type } = renderForm()
        submit()

        type('email', 'not-an-email')
        expect(screen.getByText('Invalid email address')).toBeInTheDocument()
        expect(screen.queryByText('Email is required')).not.toBeInTheDocument()

        type('message', 'hi')
        expect(screen.getByText('Message too short')).toBeInTheDocument()

        type('email', 'ann@example.com')
        type('message', 'long enough message')
        expect(screen.queryByText('Invalid email address')).not.toBeInTheDocument()
        expect(screen.queryByText('Message too short')).not.toBeInTheDocument()
    })

    it('TC-F01-CONTACT-ERR-04 — typing before any submit never raises an error', () => {
        const { type } = renderForm()

        type('email', 'half-typed')
        type('message', 'x')

        expect(screen.queryAllByRole('alert')).toHaveLength(0)
    })
})
