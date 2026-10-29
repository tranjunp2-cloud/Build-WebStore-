// @vitest-environment jsdom
// #2103 A6 (industry preview + labels) and A1 (optional facts, link import tab) — real cards, grid and blueprint.
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

describe('BusinessInfoForm — optional facts (A1)', () => {
    it('TC-AIAUD-047: buying methods, service area and shop facts reach the submitted payload', async () => {
        const onSubmit = vi.fn()
        await renderForm({ onSubmit })
        fillRequired()

        fireEvent.click(screen.getByRole('button', { name: form.buyingMethodOptions.delivery }))
        fireEvent.click(screen.getByRole('button', { name: form.buyingMethodOptions.cod }))
        fireEvent.click(screen.getByRole('button', { name: form.buyingMethodOptions.pickup }))
        fireEvent.click(screen.getByRole('button', { name: form.buyingMethodOptions.pickup })) // toggled off again
        fireEvent.change(screen.getByLabelText(form.serviceAreaLabel), { target: { value: '  Klang Valley ' } })
        fireEvent.change(screen.getByLabelText(form.shopFactsLabel), { target: { value: 'Started in 2019' } })
        fireEvent.click(screen.getByRole('button', { name: form.generateButton }))

        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0]).toMatchObject({
            businessName: 'Kopi Senja',
            buyingMethods: ['delivery', 'cod'],
            serviceArea: 'Klang Valley',
            shopFacts: 'Started in 2019',
        })
    })

    it('TC-AIAUD-048: untouched optional fields are left out of the payload', async () => {
        const onSubmit = vi.fn()
        await renderForm({ onSubmit })
        fillRequired()
        fireEvent.change(screen.getByLabelText(form.shopFactsLabel), { target: { value: '   ' } })

        fireEvent.click(screen.getByRole('button', { name: form.generateButton }))

        const payload = onSubmit.mock.calls[0][0]
        expect(payload).not.toHaveProperty('buyingMethods')
        expect(payload).not.toHaveProperty('serviceArea')
        expect(payload).not.toHaveProperty('shopFacts')
    })

    it('TC-AIAUD-049: a recovered draft shows its saved buying methods, area and facts', async () => {
        await renderForm({
            initialValues: {
                businessName: 'Kopi Senja', industry: 'beauty', products: 'Coffee', shortDescription: 'Cafe',
                buyingMethods: ['booking', 'walk_in'], serviceArea: 'Penang', shopFacts: 'Since 2015',
            },
        })

        expect(screen.getByRole('button', { name: form.buyingMethodOptions.booking })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: form.buyingMethodOptions.walk_in })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: form.buyingMethodOptions.delivery })).toHaveAttribute('aria-pressed', 'false')
        expect(screen.getByLabelText(form.serviceAreaLabel)).toHaveValue('Penang')
        expect(screen.getByLabelText(form.shopFactsLabel)).toHaveValue('Since 2015')
    })

    it('TC-AIAUD-050: the link import tab is back and asks for a website, Instagram or Facebook link', async () => {
        await renderForm()
        expect(screen.getByRole('tab', { name: form.tabManual })).toHaveAttribute('aria-selected', 'true')

        fireEvent.click(screen.getByRole('tab', { name: form.tabUrl }))

        expect(screen.getByLabelText('Your website, Instagram or Facebook link')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: form.extractButton })).toBeDisabled()
        // the generate button belongs to the manual form only
        expect(screen.queryByRole('button', { name: form.generateButton })).not.toBeInTheDocument()
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
