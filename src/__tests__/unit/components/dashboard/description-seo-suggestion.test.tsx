/**
 * TC-AIWB-27 — the product form's AI preview: "Write with AI" shows the suggestion and leaves the description
 * unchanged until "Use this"; Discard leaves the form as it was; AI SEO shows now → suggested for title,
 * description and slug, and an empty suggested slug keeps the current one.
 * Real: DescriptionSeoSection.tsx (AiSuggestionPanel), react-hook-form, the Input/Textarea/Button primitives,
 * the real en.json strings through I18nProvider.
 * Faked: the two AI routes (fetch), sonner toasts, the form values (a FormProvider harness).
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { DescriptionSeoSection } from '@/components/dashboard/product-form/DescriptionSeoSection'
import { I18nProvider } from '@/i18n'

vi.mock('sonner', () => ({
    toast: Object.assign(vi.fn(), {
        error: vi.fn(),
        success: vi.fn(),
        loading: vi.fn(() => 'toast-1'),
        dismiss: vi.fn(),
    }),
}))

const FORM_VALUES = {
    name: 'Batik Kain Sutera',
    categoryIds: [],
    description: 'Original description text',
    metaTitle: 'Old meta title',
    metaDescription: 'Old meta description',
    urlSlug: 'old-slug',
}

function Harness({ values = FORM_VALUES }: { values?: Record<string, unknown> }) {
    const methods = useForm({ defaultValues: values as never })
    return (
        <I18nProvider defaultLocale="en">
            <FormProvider {...methods}>
                <DescriptionSeoSection />
            </FormProvider>
        </I18nProvider>
    )
}

const descriptionBox = () => screen.getByPlaceholderText('Enter detailed product description...') as HTMLTextAreaElement
const metaTitleBox = () => screen.getByPlaceholderText('Title for SEO') as HTMLInputElement
const metaDescriptionBox = () => screen.getByPlaceholderText('Brief description for search engines (150-160 chars)') as HTMLTextAreaElement
const slugBox = () => screen.getByPlaceholderText('product-url') as HTMLInputElement

const jsonResponse = (body: unknown) => ({ json: async () => body }) as Response

/** The panel appears before the request's finally-block state update; wait for the button to settle inside act. */
const settleDescription = () => waitFor(() => expect(screen.getByRole('button', { name: 'Write with AI' })).toBeEnabled())
const settleSeo = () => waitFor(() => expect(screen.getByRole('button', { name: /ai optimization/i })).toBeEnabled())

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

describe('DescriptionSeoSection — "Write with AI" preview [TC-AIWB-27]', () => {
    it('shows the suggestion and leaves the description unchanged until "Use this"', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { description: 'Kain sutera batik tulen, ditenun tangan.' } }))
        render(<Harness />)

        fireEvent.click(screen.getByRole('button', { name: 'Write with AI' }))

        const panel = await screen.findByRole('region', { name: 'AI suggestion' })
        await settleDescription()
        expect(within(panel).getByText('Kain sutera batik tulen, ditenun tangan.')).toBeInTheDocument()
        expect(descriptionBox()).toHaveValue('Original description text')
        expect(fetchMock).toHaveBeenCalledWith('/api/ai/product-description', expect.objectContaining({ method: 'POST' }))
        expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ name: 'Batik Kain Sutera', category: '', language: 'en' })

        // setValue with shouldValidate runs async validation: flush it inside act
        await act(async () => {
            fireEvent.click(within(panel).getByRole('button', { name: 'Use this' }))
        })

        expect(descriptionBox()).toHaveValue('Kain sutera batik tulen, ditenun tangan.')
        expect(screen.queryByRole('region', { name: 'AI suggestion' })).not.toBeInTheDocument()
    })

    it('Discard closes the suggestion and leaves the form as it was', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { description: 'Teks baharu' } }))
        render(<Harness />)
        fireEvent.click(screen.getByRole('button', { name: 'Write with AI' }))
        const panel = await screen.findByRole('region', { name: 'AI suggestion' })
        await settleDescription()

        fireEvent.click(within(panel).getByRole('button', { name: 'Discard' }))

        expect(screen.queryByRole('region', { name: 'AI suggestion' })).not.toBeInTheDocument()
        expect(descriptionBox()).toHaveValue('Original description text')
        expect(screen.queryByText('Teks baharu')).not.toBeInTheDocument()
    })

    it('a failed generation shows no suggestion and leaves the description alone', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, error: 'quota' }))
        render(<Harness />)

        fireEvent.click(screen.getByRole('button', { name: 'Write with AI' }))

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Write with AI' })).toBeEnabled())
        expect(screen.queryByRole('region', { name: 'AI suggestion' })).not.toBeInTheDocument()
        expect(descriptionBox()).toHaveValue('Original description text')
    })
})

describe('DescriptionSeoSection — "AI optimization" SEO preview [TC-AIWB-27]', () => {
    it('shows now → suggested for the meta title, meta description and slug, and applies them on "Use this"', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { title: 'Kain Batik Sutera Tulen', description: 'Beli kain batik sutera tulen dengan penghantaran pantas.', slug: 'kain-batik-sutera-tulen' } }))
        render(<Harness />)

        fireEvent.click(screen.getByRole('button', { name: /ai optimization/i }))

        const panel = await screen.findByRole('region', { name: 'AI suggestion' })
        await settleSeo()
        expect(fetchMock).toHaveBeenCalledWith('/api/ai/seo-generate', expect.objectContaining({ method: 'POST' }))
        expect(within(panel).getByText('Now: Old meta title')).toBeInTheDocument()
        expect(within(panel).getByText('Kain Batik Sutera Tulen')).toBeInTheDocument()
        expect(within(panel).getByText('Now: Old meta description')).toBeInTheDocument()
        expect(within(panel).getByText('Beli kain batik sutera tulen dengan penghantaran pantas.')).toBeInTheDocument()
        expect(within(panel).getByText('Now: old-slug')).toBeInTheDocument()
        expect(within(panel).getByText('kain-batik-sutera-tulen')).toBeInTheDocument()
        expect(metaTitleBox()).toHaveValue('Old meta title')
        expect(slugBox()).toHaveValue('old-slug')

        // setValue with shouldValidate runs async validation: flush it inside act
        await act(async () => {
            fireEvent.click(within(panel).getByRole('button', { name: 'Use this' }))
        })

        expect(metaTitleBox()).toHaveValue('Kain Batik Sutera Tulen')
        expect(metaDescriptionBox()).toHaveValue('Beli kain batik sutera tulen dengan penghantaran pantas.')
        expect(slugBox()).toHaveValue('kain-batik-sutera-tulen')
        expect(screen.queryByRole('region', { name: 'AI suggestion' })).not.toBeInTheDocument()
    })

    it('an empty suggested slug keeps the current slug (no slug row is offered)', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { title: 'Kain Batik', description: 'Kain batik tulen.', slug: '' } }))
        render(<Harness />)
        fireEvent.click(screen.getByRole('button', { name: /ai optimization/i }))
        const panel = await screen.findByRole('region', { name: 'AI suggestion' })
        await settleSeo()

        expect(within(panel).queryByText('URL slug')).not.toBeInTheDocument()

        // setValue with shouldValidate runs async validation: flush it inside act
        await act(async () => {
            fireEvent.click(within(panel).getByRole('button', { name: 'Use this' }))
        })

        expect(metaTitleBox()).toHaveValue('Kain Batik')
        expect(metaDescriptionBox()).toHaveValue('Kain batik tulen.')
        expect(slugBox()).toHaveValue('old-slug')
    })

    it('Discard on the SEO suggestion leaves the title, description and slug as they were', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { title: 'Lain', description: 'Lain pula', slug: 'lain' } }))
        render(<Harness />)
        fireEvent.click(screen.getByRole('button', { name: /ai optimization/i }))
        const panel = await screen.findByRole('region', { name: 'AI suggestion' })
        await settleSeo()

        fireEvent.click(within(panel).getByRole('button', { name: 'Discard' }))

        expect(screen.queryByRole('region', { name: 'AI suggestion' })).not.toBeInTheDocument()
        expect(metaTitleBox()).toHaveValue('Old meta title')
        expect(metaDescriptionBox()).toHaveValue('Old meta description')
        expect(slugBox()).toHaveValue('old-slug')
    })
})
