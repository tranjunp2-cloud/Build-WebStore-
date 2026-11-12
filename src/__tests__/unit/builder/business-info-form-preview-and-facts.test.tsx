// @vitest-environment jsdom
// #2103 A6 (industry preview + labels) and A1 (no optional facts fields and no link import tab, #2176) — real cards, grid and blueprint.
import React from 'react'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import { generateSiteSchema, BUYING_METHODS } from '@/lib/validations/ai'
import BusinessInfoForm from '@/components/builder/BusinessInfoForm'

// jsdom has no PointerEvent: without it `pointerType` is always undefined and a hover test proves nothing
class TestPointerEvent extends MouseEvent {
    pointerType: string
    constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) {
        super(type, init)
        this.pointerType = init.pointerType ?? ''
    }
}
Object.defineProperty(window, 'PointerEvent', { value: TestPointerEvent, configurable: true, writable: true })

const mockSetBusinessInfo = vi.fn()

vi.mock('@/store/builderStore', () => ({
    useBuilderStore: (selector: (s: Record<string, unknown>) => unknown) =>
        selector({ setBusinessInfo: mockSetBusinessInfo, setBusinessInfoDraft: vi.fn(), setContentBrief: vi.fn() }),
}))

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: en,
        ti: (template: string, vars: Record<string, string | number>) =>
            template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? '')),
    }),
}))

vi.mock('@/components/onboarding/SlugPicker', () => ({ default: () => null }))

vi.mock('@/components/builder/onboarding/BuilderStepScreen', () => ({
    BuilderStepScreen: (props: { leftBody: React.ReactNode; leftFooter?: React.ReactNode; right: React.ReactNode }) => (
        <div>
            <div data-testid="left-body">{props.leftBody}</div>
            <div data-testid="left-footer">{props.leftFooter}</div>
            <div data-testid="right-pane">{props.right}</div>
        </div>
    ),
}))

const INDUSTRIES = ['restaurant', 'beauty', 'realestate', 'fnb'].map((value) => ({ value, label: value }))
const form = en.onboarding.form
const label = (value: keyof typeof form.industryOptions) => form.industryOptions[value]

function mockIndustriesFetch() {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ docs: INDUSTRIES }) }) as Mock
}

async function renderForm(props: React.ComponentProps<typeof BusinessInfoForm> = {}) {
    render(<BusinessInfoForm {...props} />)
    await screen.findByRole('button', { name: label('beauty') })
}

const card = (value: keyof typeof form.industryOptions) => screen.getByRole('button', { name: label(value) })
const preview = () => within(screen.getByTestId('right-pane'))
const mouse = { pointerType: 'mouse' }

function enterCard(value: keyof typeof form.industryOptions, init: Record<string, unknown> = mouse) {
    fireEvent.pointerOver(card(value), init)
}

function leaveGrid(from: keyof typeof form.industryOptions) {
    fireEvent.pointerOut(card(from), { ...mouse, relatedTarget: document.body })
}

function fillRequired() {
    fireEvent.change(screen.getByPlaceholderText(form.businessNamePlaceholder), { target: { value: 'Kopi Senja' } })
    fireEvent.change(screen.getByPlaceholderText(form.productsPlaceholder), { target: { value: 'Coffee and kuih' } })
    fireEvent.change(screen.getByPlaceholderText(form.shortDescriptionPlaceholder), { target: { value: 'A neighbourhood cafe' } })
    fireEvent.click(card('beauty'))
}

beforeEach(() => {
    vi.clearAllMocks()
    mockIndustriesFetch()
})

describe('BusinessInfoForm — industry preview (A6)', () => {
    it('TC-AIAUD-040: hovering another card previews it, leaving the grid shows the selected industry again', async () => {
        await renderForm()
        fireEvent.click(card('beauty'))

        enterCard('realestate')
        expect(preview().getByText(label('realestate'))).toBeInTheDocument()

        leaveGrid('realestate')
        expect(preview().getByText(label('beauty'))).toBeInTheDocument()
        expect(preview().queryByText(label('realestate'))).not.toBeInTheDocument()
    })

    it('TC-AIAUD-041: a touch or pen pointer does not change the preview', async () => {
        await renderForm()
        fireEvent.click(card('beauty'))

        enterCard('realestate', { pointerType: 'touch' })
        enterCard('restaurant', { pointerType: 'pen' })

        expect(preview().getByText(label('beauty'))).toBeInTheDocument()
        expect(preview().queryByText(label('realestate'))).not.toBeInTheDocument()
        expect(preview().queryByText(label('restaurant'))).not.toBeInTheDocument()
    })

    it('TC-AIAUD-042: selecting the hovered card makes it the preview and a later leave keeps it', async () => {
        await renderForm()
        fireEvent.click(card('beauty'))
        enterCard('realestate')

        fireEvent.click(card('realestate'))
        leaveGrid('realestate')

        expect(card('realestate')).toHaveAttribute('aria-pressed', 'true')
        expect(preview().getByText(label('realestate'))).toBeInTheDocument()
    })

    it('TC-AIAUD-043: moving focus into a field clears a hover preview that never got a leave', async () => {
        await renderForm()
        fireEvent.click(card('beauty'))
        enterCard('realestate')
        expect(preview().getByText(label('realestate'))).toBeInTheDocument()

        fireEvent.focus(screen.getByPlaceholderText(form.businessNamePlaceholder))

        expect(preview().queryByText(label('realestate'))).not.toBeInTheDocument()
        expect(preview().getByText(label('beauty'))).toBeInTheDocument()
    })

    it('TC-AIAUD-044: moving from one card straight onto another previews only the second', async () => {
        await renderForm()
        fireEvent.click(card('beauty'))
        enterCard('realestate')

        fireEvent.pointerOut(card('realestate'), { ...mouse, relatedTarget: card('restaurant') })
        enterCard('restaurant')

        expect(preview().getByText(label('restaurant'))).toBeInTheDocument()
        expect(preview().queryByText(label('realestate'))).not.toBeInTheDocument()
    })
})

describe('industry labels (A6)', () => {
    it.each([['en', en], ['ms', ms]] as const)('TC-AIAUD-045: %s industry labels are all different', (_locale, dict) => {
        const labels = Object.values(dict.onboarding.form.industryOptions)
        expect(new Set(labels).size).toBe(labels.length)
    })

    it('TC-AIAUD-046: restaurant and fnb stay separate values with non-overlapping English labels', () => {
        expect(en.onboarding.form.industryOptions.restaurant).toBe('Restaurant / dine-in')
        expect(en.onboarding.form.industryOptions.fnb).toBe('Café / bakery / desserts')
        expect(Object.keys(en.onboarding.form.industryOptions)).toEqual(Object.keys(ms.onboarding.form.industryOptions))
    })
})

describe('BusinessInfoForm — no optional facts fields (#2176, prototype #2042)', () => {
    it('TC-AIAUD-047: the form ends at Short description — no "how customers buy", "areas you serve" or "facts" fields', async () => {
        await renderForm()

        expect(screen.queryByText(form.buyingMethodsLabel)).not.toBeInTheDocument()
        expect(screen.queryByText(form.serviceAreaLabel)).not.toBeInTheDocument()
        expect(screen.queryByText(form.shopFactsLabel)).not.toBeInTheDocument()
        expect(screen.queryByText(form.optionalLabel)).not.toBeInTheDocument()
        expect(screen.getByPlaceholderText(form.shortDescriptionPlaceholder)).toBeInTheDocument()
    })

    it('TC-AIAUD-048: the submitted payload carries only the form fields', async () => {
        const onSubmit = vi.fn()
        await renderForm({ onSubmit })
        fillRequired()

        fireEvent.click(screen.getByRole('button', { name: form.generateButton }))

        const payload = onSubmit.mock.calls[0][0]
        expect(payload).toMatchObject({ businessName: 'Kopi Senja' })
        expect(payload).not.toHaveProperty('buyingMethods')
        expect(payload).not.toHaveProperty('serviceArea')
        expect(payload).not.toHaveProperty('shopFacts')
    })

    it('TC-AIAUD-049: values an older draft still carries are not sent', async () => {
        const onSubmit = vi.fn()
        await renderForm({
            onSubmit,
            initialValues: {
                businessName: 'Kopi Senja', industry: 'beauty', products: 'Coffee', shortDescription: 'Cafe',
                buyingMethods: ['booking', 'walk_in'], serviceArea: 'Penang', shopFacts: 'Since 2015',
            },
        })

        fireEvent.click(screen.getByRole('button', { name: form.generateButton }))

        const payload = onSubmit.mock.calls[0][0]
        expect(payload).toMatchObject({ businessName: 'Kopi Senja', industry: 'beauty' })
        expect(payload).not.toHaveProperty('buyingMethods')
        expect(payload).not.toHaveProperty('serviceArea')
        expect(payload).not.toHaveProperty('shopFacts')
    })

    it('TC-AIAUD-050: no input-method tabs — the link import stays hidden (#2176)', async () => {
        await renderForm()

        expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
        expect(screen.queryByText(form.tabManual)).not.toBeInTheDocument()
        expect(screen.queryByText(form.tabUrl)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: form.generateButton })).toBeInTheDocument()
    })
})

describe('generateSiteSchema — optional facts (A1)', () => {
    const base = { businessName: 'Kopi Senja', industry: 'restaurant', products: 'Coffee', shortDescription: 'Cafe' }
    const parse = (businessInfo: Record<string, unknown>) => generateSiteSchema.safeParse({ businessInfo: { ...base, ...businessInfo } })

    it('TC-AIAUD-051: accepts the three optional fields within their limits, and none at all', () => {
        expect(parse({}).success).toBe(true)
        const ok = parse({ buyingMethods: [...BUYING_METHODS], serviceArea: 'a'.repeat(120), shopFacts: 'b'.repeat(500) })
        expect(ok.success).toBe(true)
        expect(ok.success && ok.data.businessInfo.buyingMethods).toEqual([...BUYING_METHODS])
    })

    it('TC-AIAUD-052: rejects an unknown buying method, a too long area and too long facts', () => {
        expect(parse({ buyingMethods: ['drone'] }).success).toBe(false)
        expect(parse({ serviceArea: 'a'.repeat(121) }).success).toBe(false)
        expect(parse({ shopFacts: 'b'.repeat(501) }).success).toBe(false)
    })
})
