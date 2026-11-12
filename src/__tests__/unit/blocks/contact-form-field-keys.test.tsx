/**
 * Unit Tests: Contact form submits canonical keys for AI-generated fieldNames (GH-2243)
 * TC-ID: TC-F01-CONTACT-KEY-01..02, 06
 * Convention: docs/TEST_CONVENTION.md
 *
 * Real ContactBlock + useContactForm. Only fetch and framer-motion are stubbed.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

const GARBLED = 'Kedai kopi Ipoh untuk ujian QA'

const renderForm = (required = true) => {
    const block = {
        blockType: 'contact' as const,
        variant: 'form' as const,
        formFields: [
            { fieldName: GARBLED, fieldType: 'text', label: 'Nama', required },
            { fieldName: 'emel', fieldType: 'email', label: 'E-mel', required },
            { fieldName: 'mesej', fieldType: 'textarea', label: 'Mesej', required },
        ],
    } as unknown as Parameters<typeof ContactBlock>[0]['block']
    const site = { id: 1 } as unknown as Parameters<typeof ContactBlock>[0]['site']
    const utils = render(<ContactBlock block={block} site={site} />)
    const form = utils.container.querySelector('form') as HTMLFormElement
    const field = (i: number) => form.querySelectorAll('input:not([name="website"]), textarea')[i] as HTMLInputElement
    return { form, field }
}

afterEach(() => vi.unstubAllGlobals())

describe('[TC-F01-CONTACT-KEY] Contact form canonical request keys', () => {
    it('TC-F01-CONTACT-KEY-01 — filled form with garbled fieldNames posts name/email/message', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
        vi.stubGlobal('fetch', fetchMock)
        const { form, field } = renderForm()

        fireEvent.change(field(0), { target: { value: 'Ann' } })
        fireEvent.change(field(1), { target: { value: 'ann@example.com' } })
        fireEvent.change(field(2), { target: { value: 'Hello there' } })
        fireEvent.submit(form)

        expect(await screen.findByText('Thanks for reaching out!')).toBeInTheDocument()
        const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
        expect(body).toMatchObject({ name: 'Ann', email: 'ann@example.com', message: 'Hello there', siteId: '1' })
    })

    it('TC-F01-CONTACT-KEY-02 — empty garbled name field is blocked client-side, no fetch', async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        const { form, field } = renderForm()

        fireEvent.change(field(1), { target: { value: 'ann@example.com' } })
        fireEvent.change(field(2), { target: { value: 'Hello there' } })
        fireEvent.submit(form)

        await waitFor(() => expect(screen.getByText('Name is required')).toBeInTheDocument())
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('TC-F01-CONTACT-KEY-06 — name/email/message are required client-side like the API, even when flagged optional', async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        const { form, field } = renderForm(false)
        // The field shows as required too (marker + aria), not only on submit.
        for (const i of [0, 1, 2]) expect(field(i)).toHaveAttribute('aria-required', 'true')

        fireEvent.submit(form)
        await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(3))
        expect(fetchMock).not.toHaveBeenCalled()

        fireEvent.change(field(0), { target: { value: 'Ann' } })
        fireEvent.change(field(1), { target: { value: 'not-an-email' } })
        fireEvent.change(field(2), { target: { value: 'hey' } })
        fireEvent.submit(form)

        await waitFor(() => expect(screen.getByText('Invalid email address')).toBeInTheDocument())
        expect(screen.getByText('Message too short')).toBeInTheDocument()
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
