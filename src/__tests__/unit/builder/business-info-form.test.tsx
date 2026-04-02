// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import BusinessInfoForm from '../../../components/builder/BusinessInfoForm'

// ── Mocks ────────────────────────────────────────────────────────────────

const mockSetBusinessInfo = vi.fn()

vi.mock('@/store/builderStore', () => ({
    useBuilderStore: (selector: (s: Record<string, unknown>) => unknown) =>
        selector({ setBusinessInfo: mockSetBusinessInfo }),
}))

// Mock i18n
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            onboarding: {
                step1Title: 'Create Website with AI',
                step1Subtitle: 'Business Information',
                form: {
                    businessName: 'Business Name',
                    businessNamePlaceholder: 'e.g. Acme Studio',
                    industry: 'Industry',
                    loadingIndustries: 'Loading industries...',
                    products: 'Products / Services',
                    productsHint: 'What do you sell?',
                    productsPlaceholder: 'e.g. Custom website design...',
                    shortDescription: 'Short Description',
                    shortDescriptionHint: 'What is your business about?',
                    shortDescriptionPlaceholder: 'e.g. We are a creative agency...',
                    generateButton: 'Continue',
                    promoTitle: 'AI Builder',
                    promoDescription: 'Let AI build your website.',
                    promoStep1: 'Describe',
                    promoStep2: 'Generate',
                    promoStep3: 'Refine',
                    errors: {
                        businessName: 'Please enter your business name',
                        industry: 'Please select an industry',
                        products: 'Please describe your products / services',
                        shortDescription: 'Please describe your business',
                    },
                    errorMessage: 'Generation failed, please try again.',
                    retryWithCurrent: 'Retry with current information',
                }
            }
        }
    })
}))

// Stub builder sub-components so tests focus on BusinessInfoForm logic
vi.mock('@/components/builder/fields/BuilderField', () => ({
    BuilderField: ({ children, label, error, required }: {
        children: React.ReactNode; label: string; error?: string; required?: boolean
    }) => (
        <div data-testid={`field-${label.toLowerCase().replace(/\s+/g, '-')}`}>
            <label>{label}{required && ' *'}</label>
            {error && <span role="alert">{error}</span>}
            {children}
        </div>
    ),
}))

vi.mock('@/components/builder/fields/BuilderTextInput', () => ({
    BuilderTextInput: (props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) => (
        <input
            aria-invalid={props.invalid}
            data-testid="builder-text-input"
            onChange={props.onChange}
            placeholder={props.placeholder}
            type={props.type}
            value={props.value}
        />
    ),
}))

vi.mock('@/components/builder/fields/BuilderTextarea', () => ({
    BuilderTextarea: (props: {
        value?: string; onChange?: React.ChangeEventHandler<HTMLTextAreaElement>
        placeholder?: string; rows?: number; invalid?: boolean; adornment?: React.ReactNode
    }) => (
        <textarea
            aria-invalid={props.invalid}
            data-testid="builder-textarea"
            onChange={props.onChange}
            placeholder={props.placeholder}
            rows={props.rows}
            value={props.value}
        />
    ),
}))

vi.mock('@/components/builder/fields/BuilderOptionCard', () => ({
    BuilderOptionCard: (props: { label: string; selected?: boolean; onClick?: () => void }) => (
        <button
            aria-pressed={props.selected}
            data-testid={`option-${props.label}`}
            onClick={props.onClick}
            type="button"
        >
            {props.label}
        </button>
    ),
}))

vi.mock('@/components/builder/fields/BuilderOptionGrid', () => ({
    BuilderOptionGrid: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="option-grid">{children}</div>
    ),
}))

vi.mock('@/components/builder/fields/BuilderSubmitButton', () => ({
    BuilderSubmitButton: (props: {
        children: React.ReactNode; disabled?: boolean; loading?: boolean; onClick?: () => void; type?: string
    }) => (
        <button
            data-testid="submit-button"
            disabled={props.disabled}
            data-loading={props.loading ? 'true' : 'false'}
            onClick={props.onClick}
            type="button"
        >
            {props.children}
        </button>
    ),
}))

vi.mock('@/components/builder/onboarding/BuilderStepScreen', () => ({
    BuilderStepScreen: (props: {
        title: string; subtitle: string; description: string
        leftBody: React.ReactNode; leftFooter: React.ReactNode; right: React.ReactNode
    }) => (
        <div data-testid="step-screen">
            <h1>{props.title}</h1>
            <h2>{props.subtitle}</h2>
            <p>{props.description}</p>
            <div data-testid="left-body">{props.leftBody}</div>
            <div data-testid="left-footer">{props.leftFooter}</div>
            <div data-testid="right-pane">{props.right}</div>
        </div>
    ),
}))

vi.mock('@/components/builder/onboarding/BuilderPromoCard', () => ({
    BuilderPromoCard: (props: { title: string; description: string }) => (
        <div data-testid="promo-card">{props.title}</div>
    ),
}))

// ── Helpers ──────────────────────────────────────────────────────────────

const MOCK_INDUSTRIES = [
    { value: 'food', label: 'Food & Beverage', icon: '🍕' },
    { value: 'beauty', label: 'Beauty & Spa', icon: '💅' },
    { value: 'tech', label: 'Technology', icon: '💻' },
]

function mockFetchSuccess(industries = MOCK_INDUSTRIES) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ docs: industries }),
    }) as Mock
}

function mockFetchFailure() {
    global.fetch = vi.fn().mockResolvedValue({
        ok: false,
    }) as Mock
}

function fillForm() {
    const inputs = screen.getAllByTestId('builder-text-input')
    const textareas = screen.getAllByTestId('builder-textarea')

    // Business Name
    fireEvent.change(inputs[0], { target: { value: 'My Coffee Shop' } })
    // Products / Services
    fireEvent.change(textareas[0], { target: { value: 'Premium coffee, pastries' } })
    // Description
    fireEvent.change(textareas[1], { target: { value: 'A cozy neighborhood coffee shop' } })
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('BusinessInfoForm Component', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetchSuccess()
    })

    // ── Rendering ────────────────────────────────────────────────────────

    describe('Rendering', () => {
        it('renders the step screen with correct titles', async () => {
            render(<BusinessInfoForm />)
            await waitFor(() => expect(screen.getByText('Create Website with AI')).toBeInTheDocument())
            expect(screen.getByText('Business Information')).toBeInTheDocument()
        })

        it('renders all required form fields', async () => {
            render(<BusinessInfoForm />)
            await waitFor(() => {
                expect(screen.getByTestId('field-business-name')).toBeInTheDocument()
            })
            expect(screen.getByTestId('field-industry')).toBeInTheDocument()
            expect(screen.getByTestId('field-products-/-services')).toBeInTheDocument()
            expect(screen.getByTestId('field-short-description')).toBeInTheDocument()
        })

        it('renders industry options after fetch', async () => {
            render(<BusinessInfoForm />)
            await waitFor(() => {
                expect(screen.getByTestId('option-Food & Beverage')).toBeInTheDocument()
            })
            expect(screen.getByTestId('option-Beauty & Spa')).toBeInTheDocument()
            expect(screen.getByTestId('option-Technology')).toBeInTheDocument()
        })

        it('renders submit button', async () => {
            render(<BusinessInfoForm />)
            await waitFor(() => {
                expect(screen.getByTestId('submit-button')).toBeInTheDocument()
            })
        })

        it('renders promo card in right pane', async () => {
            render(<BusinessInfoForm />)
            await waitFor(() => {
                expect(screen.getByTestId('promo-card')).toBeInTheDocument()
            })
        })
    })

    // ── Validation ───────────────────────────────────────────────────────

    describe('Validation', () => {
        it('shows validation errors when submitting with partial data', async () => {
            // Fill only businessName so the button becomes "not disabled" via isFormReady
            // but validation catches missing fields. We need all 4 filled for isFormReady,
            // so we test via form submit (Enter key on the form) instead of button click.
            render(<BusinessInfoForm onSubmit={vi.fn()} />)
            await waitFor(() => expect(screen.getByTestId('submit-button')).toBeInTheDocument())

            // Submit the form element directly (bypasses disabled button)
            const form = screen.getByTestId('left-body').querySelector('form')!
            fireEvent.submit(form)

            await waitFor(() => {
                expect(screen.getByText('Please enter your business name')).toBeInTheDocument()
            })
            expect(screen.getByText('Please select an industry')).toBeInTheDocument()
            expect(screen.getByText('Please describe your business')).toBeInTheDocument()
            expect(screen.getByText('Please describe your products / services')).toBeInTheDocument()
        })

        it('does not call onSubmit when validation fails', async () => {
            const onSubmit = vi.fn()
            render(<BusinessInfoForm onSubmit={onSubmit} />)
            await waitFor(() => expect(screen.getByTestId('submit-button')).toBeInTheDocument())

            // Submit the form directly to trigger validate()
            const form = screen.getByTestId('left-body').querySelector('form')!
            fireEvent.submit(form)

            expect(onSubmit).not.toHaveBeenCalled()
        })

        it('submit button is disabled when form is incomplete', async () => {
            render(<BusinessInfoForm />)
            await waitFor(() => expect(screen.getByTestId('submit-button')).toBeInTheDocument())

            expect(screen.getByTestId('submit-button')).toBeDisabled()
        })
    })

    // ── Submit ───────────────────────────────────────────────────────────

    describe('Submit', () => {
        it('calls onSubmit with form data when all fields are filled', async () => {
            const onSubmit = vi.fn()
            render(<BusinessInfoForm onSubmit={onSubmit} />)

            await waitFor(() => expect(screen.getByTestId('option-Food & Beverage')).toBeInTheDocument())

            fillForm()
            fireEvent.click(screen.getByTestId('option-Food & Beverage'))
            fireEvent.click(screen.getByTestId('submit-button'))

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledTimes(1)
            })

            expect(onSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    businessName: 'My Coffee Shop',
                    industry: 'food',
                    products: 'Premium coffee, pastries',
                    shortDescription: 'A cozy neighborhood coffee shop',
                    language: 'auto',
                }),
            )
        })

        it('calls setBusinessInfo from store when no onSubmit prop', async () => {
            render(<BusinessInfoForm />)

            await waitFor(() => expect(screen.getByTestId('option-Food & Beverage')).toBeInTheDocument())

            fillForm()
            fireEvent.click(screen.getByTestId('option-Food & Beverage'))
            fireEvent.click(screen.getByTestId('submit-button'))

            await waitFor(() => {
                expect(mockSetBusinessInfo).toHaveBeenCalledTimes(1)
            })

            expect(mockSetBusinessInfo).toHaveBeenCalledWith(
                expect.objectContaining({
                    businessName: 'My Coffee Shop',
                    industry: 'food',
                }),
            )
        })

        it('does not submit when isGenerating is true', async () => {
            const onSubmit = vi.fn()
            render(<BusinessInfoForm isGenerating onSubmit={onSubmit} />)

            await waitFor(() => expect(screen.getByTestId('option-Food & Beverage')).toBeInTheDocument())

            fillForm()
            fireEvent.click(screen.getByTestId('option-Food & Beverage'))
            fireEvent.click(screen.getByTestId('submit-button'))

            expect(onSubmit).not.toHaveBeenCalled()
        })
    })

    // ── Error state ──────────────────────────────────────────────────────

    describe('Error state', () => {
        it('displays error message when errorMessage prop is set', async () => {
            render(<BusinessInfoForm errorMessage="Generation failed, please try again." />)

            await waitFor(() => {
                expect(screen.getByText('Generation failed, please try again.')).toBeInTheDocument()
            })
        })

        it('shows retry button when onRetry is provided with error', async () => {
            const onRetry = vi.fn()
            render(
                <BusinessInfoForm
                    errorMessage="Something went wrong"
                    onRetry={onRetry}
                />,
            )

            await waitFor(() => {
                expect(screen.getByText('Retry with current information')).toBeInTheDocument()
            })
        })

        it('calls onRetry with current form data when retry is clicked', async () => {
            const onRetry = vi.fn()
            render(
                <BusinessInfoForm
                    errorMessage="Something went wrong"
                    initialValues={{ businessName: 'Test Biz', shortDescription: 'desc', industry: 'food', products: 'items' }}
                    onRetry={onRetry}
                />,
            )

            await waitFor(() => {
                expect(screen.getByText('Retry with current information')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('Retry with current information'))

            expect(onRetry).toHaveBeenCalledTimes(1)
            expect(onRetry).toHaveBeenCalledWith(
                expect.objectContaining({ businessName: 'Test Biz' }),
            )
        })

        it('does not show retry button when onRetry is not provided', async () => {
            render(<BusinessInfoForm errorMessage="Something went wrong" />)

            await waitFor(() => {
                expect(screen.getByText('Something went wrong')).toBeInTheDocument()
            })

            expect(screen.queryByText('Retry with current information')).not.toBeInTheDocument()
        })
    })

    // ── Loading state ────────────────────────────────────────────────────

    describe('Loading state', () => {
        it('shows loading text while fetching industries', () => {
            // fetch never resolves during sync render
            global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as Mock
            render(<BusinessInfoForm />)

            expect(screen.getByText('Loading industries...')).toBeInTheDocument()
        })

        it('submit button reflects isGenerating loading state', async () => {
            render(<BusinessInfoForm isGenerating />)

            await waitFor(() => expect(screen.getByTestId('submit-button')).toBeInTheDocument())

            const btn = screen.getByTestId('submit-button')
            expect(btn).toBeDisabled()
            expect(btn).toHaveAttribute('data-loading', 'true')
        })

        it('hides loading text after industries are fetched', async () => {
            render(<BusinessInfoForm />)

            await waitFor(() => {
                expect(screen.queryByText('Loading industries...')).not.toBeInTheDocument()
            })
        })
    })

    // ── Initial values ───────────────────────────────────────────────────

    describe('Initial values', () => {
        it('pre-fills form when initialValues prop is provided', async () => {
            render(
                <BusinessInfoForm
                    initialValues={{
                        businessName: 'Pre-filled Biz',
                        shortDescription: 'Pre-filled desc',
                        industry: 'beauty',
                        products: 'Pre-filled products',
                    }}
                />,
            )

            await waitFor(() => {
                const inputs = screen.getAllByTestId('builder-text-input')
                expect(inputs[0]).toHaveValue('Pre-filled Biz')
            })

            const textareas = screen.getAllByTestId('builder-textarea')
            expect(textareas[0]).toHaveValue('Pre-filled products')
            expect(textareas[1]).toHaveValue('Pre-filled desc')
        })
    })

    // ── Industry fetch failure ───────────────────────────────────────────

    describe('Industry fetch failure', () => {
        it('renders no options when industry fetch fails', async () => {
            mockFetchFailure()
            render(<BusinessInfoForm />)

            await waitFor(() => {
                expect(screen.queryByText('Loading industries...')).not.toBeInTheDocument()
            })

            expect(screen.queryByTestId('option-Food & Beverage')).not.toBeInTheDocument()
        })
    })
})
