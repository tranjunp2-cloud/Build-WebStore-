// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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
                    blueprintCaption: 'AI builds this template from your details',
                    blueprintReady: 'All set',
                    blueprintCount: '{count} of 4 details added',
                    errors: {
                        businessName: 'Please enter your business name',
                        industry: 'Please select an industry',
                        products: 'Please describe your products / services',
                        shortDescription: 'Please describe your business',
                        minLength: 'Must be at least {count} characters',
                    },
                    optionalLabel: 'Optional',
                    buyingMethodsLabel: 'How do customers buy from you?',
                    buyingMethodsHint: 'Only the ways you pick are mentioned.',
                    buyingMethodOptions: {
                        delivery: 'Delivery', pickup: 'Pickup', walk_in: 'Walk-in',
                        booking: 'Booking', cod: 'Cash on delivery', online_payment: 'Online payment',
                    },
                    serviceAreaLabel: 'Areas you serve',
                    serviceAreaPlaceholder: 'e.g. Klang Valley',
                    shopFactsLabel: 'Facts we can say about your shop',
                    shopFactsPlaceholder: 'e.g. Started in 2019',
                    shopFactsHint: 'Only add what is true.',
                    tabManual: 'Describe business',
                    tabUrl: 'Import from a link',
                    errorMessage: 'Generation failed, please try again.',
                    retryWithCurrent: 'Retry with current information',
                    slugTaken: 'This address is taken',
                }
            }
        },
        ti: (template: string, vars: Record<string, string | number>) =>
            template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? '')),
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
    BuilderTextInput: ({ invalid, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) => (
        <input {...props} aria-invalid={invalid} data-testid="builder-text-input" />
    ),
}))

vi.mock('@/components/builder/fields/BuilderTextarea', () => ({
    BuilderTextarea: ({ invalid, adornment: _adornment, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
        invalid?: boolean; adornment?: React.ReactNode
    }) => (
        <textarea {...props} aria-invalid={invalid} data-testid="builder-textarea" />
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

/** Industries load as usual; the slug check answers with the given availability. */
function mockFetchWithSlugAvailable(available: boolean) {
    global.fetch = vi.fn((url: string) => Promise.resolve(url.startsWith('/api/slug/check')
        ? { ok: true, json: () => Promise.resolve({ available }) }
        : { ok: true, json: () => Promise.resolve({ docs: MOCK_INDUSTRIES }) })) as Mock
}

const slugInput = () => screen.getByTestId('left-body').querySelector<HTMLInputElement>('[data-field="slug"] input')!

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

        it('TC-F01.04: renders live blueprint with 0/4 details in right pane', async () => {
            render(<BusinessInfoForm />)
            await waitFor(() => {
                expect(screen.getByRole('img', { name: '0 of 4 details added' })).toBeInTheDocument()
            })
            expect(screen.getByTestId('right-pane')).toHaveTextContent('AI Builder')
            expect(screen.getByText('AI builds this template from your details')).toBeInTheDocument()
        })

        it('TC-F01.04: blueprint fills live as business name is typed', async () => {
            render(<BusinessInfoForm />)
            await waitFor(() => expect(screen.getByTestId('submit-button')).toBeInTheDocument())

            const nameInput = screen.getByTestId('left-body').querySelector('input')!
            fireEvent.change(nameInput, { target: { value: 'My Coffee Shop' } })

            expect(screen.getByRole('img', { name: '1 of 4 details added' })).toBeInTheDocument()
            expect(screen.getByTestId('right-pane')).toHaveTextContent('My Coffee Shop')
        })
    })

    // ── Validation ───────────────────────────────────────────────────────

    describe('Validation', () => {
        const REQUIRED_NAME = 'Please enter your business name'
        const MIN_LENGTH = 'Must be at least 3 characters'

        const field = (testId: string) => within(screen.getByTestId(testId))
        const nameInput = () => screen.getAllByTestId('builder-text-input')[0]
        const clickGenerate = () => fireEvent.click(screen.getByTestId('submit-button'))

        async function renderLoadedForm(onSubmit = vi.fn()) {
            render(<BusinessInfoForm onSubmit={onSubmit} />)
            await waitFor(() => expect(screen.getByTestId('option-Food & Beverage')).toBeInTheDocument())
            return onSubmit
        }

        it('TC-F01.05: clicking Generate on an empty form shows an error at every required field and does not submit', async () => {
            // Arrange
            const onSubmit = await renderLoadedForm()
            expect(screen.getByTestId('submit-button')).not.toBeDisabled()

            // Act
            clickGenerate()

            // Assert
            expect(field('field-business-name').getByRole('alert')).toHaveTextContent(REQUIRED_NAME)
            expect(field('field-industry').getByRole('alert')).toHaveTextContent('Please select an industry')
            expect(field('field-products-/-services').getByRole('alert')).toHaveTextContent('Please describe your products / services')
            expect(field('field-short-description').getByRole('alert')).toHaveTextContent('Please describe your business')
            expect(onSubmit).not.toHaveBeenCalled()
        })

        it('TC-F01.05: leaving an empty field shows its error, untouched fields stay quiet', async () => {
            // Arrange
            await renderLoadedForm()

            // Act
            fireEvent.blur(nameInput())

            // Assert
            expect(field('field-business-name').getByRole('alert')).toHaveTextContent(REQUIRED_NAME)
            expect(screen.getAllByRole('alert')).toHaveLength(1)
        })

        it('TC-F01.68: a name of only spaces shows the required message, not the min-length one', async () => {
            // Arrange
            await renderLoadedForm()

            // Act
            fireEvent.change(nameInput(), { target: { value: '     ' } })
            fireEvent.blur(nameInput())

            // Assert
            expect(field('field-business-name').getByRole('alert')).toHaveTextContent(REQUIRED_NAME)
        })

        it('TC-F01.70: a 2-character name shows "Must be at least 3 characters" on blur, not while typing', async () => {
            // Arrange
            await renderLoadedForm()

            // Act + Assert — no message while the field is first being typed
            fireEvent.change(nameInput(), { target: { value: 'AB' } })
            expect(screen.queryByRole('alert')).not.toBeInTheDocument()
            fireEvent.blur(nameInput())

            // Assert
            expect(field('field-business-name').getByRole('alert')).toHaveTextContent(MIN_LENGTH)
        })

        it('TC-F01.70: padding spaces do not count toward the 3-character minimum', async () => {
            // Arrange
            await renderLoadedForm()

            // Act
            fireEvent.change(nameInput(), { target: { value: '  ab  ' } })
            fireEvent.blur(nameInput())

            // Assert
            expect(field('field-business-name').getByRole('alert')).toHaveTextContent(MIN_LENGTH)
        })

        it('TC-F01.69: a 3-character name passes on blur', async () => {
            // Arrange
            await renderLoadedForm()

            // Act
            fireEvent.change(nameInput(), { target: { value: 'ABC' } })
            fireEvent.blur(nameInput())

            // Assert
            expect(field('field-business-name').queryByRole('alert')).not.toBeInTheDocument()
        })

        it('TC-F01.70: a shown error updates while typing and clears once the value is valid', async () => {
            // Arrange
            await renderLoadedForm()
            fireEvent.change(nameInput(), { target: { value: 'AB' } })
            fireEvent.blur(nameInput())

            // Act + Assert — emptied → required, then fixed → no error
            fireEvent.change(nameInput(), { target: { value: '' } })
            expect(field('field-business-name').getByRole('alert')).toHaveTextContent(REQUIRED_NAME)
            fireEvent.change(nameInput(), { target: { value: 'ABC' } })
            expect(field('field-business-name').queryByRole('alert')).not.toBeInTheDocument()
        })

        it('TC-F01.72: no industry → error on Generate, cleared when an industry is picked', async () => {
            // Arrange
            await renderLoadedForm()
            fillForm()

            // Act
            clickGenerate()

            // Assert
            expect(field('field-industry').getByRole('alert')).toHaveTextContent('Please select an industry')
            fireEvent.click(screen.getByTestId('option-Food & Beverage'))
            expect(field('field-industry').queryByRole('alert')).not.toBeInTheDocument()
        })

        it('TC-F01.74: only the name filled → errors at all the other required fields at once', async () => {
            // Arrange
            await renderLoadedForm()
            fireEvent.change(nameInput(), { target: { value: 'My Coffee Shop' } })

            // Act
            clickGenerate()

            // Assert
            expect(field('field-business-name').queryByRole('alert')).not.toBeInTheDocument()
            expect(field('field-industry').getByRole('alert')).toBeInTheDocument()
            expect(field('field-products-/-services').getByRole('alert')).toBeInTheDocument()
            expect(field('field-short-description').getByRole('alert')).toBeInTheDocument()
        })

        it('TC-F01.68: name changed from "AB" to only spaces after filling the rest → required error, no submit', async () => {
            // Arrange
            const onSubmit = await renderLoadedForm()
            fireEvent.change(nameInput(), { target: { value: 'AB' } })
            fireEvent.click(screen.getByTestId('option-Food & Beverage'))
            fillForm()
            fireEvent.change(nameInput(), { target: { value: '   ' } })

            // Act
            clickGenerate()

            // Assert
            expect(field('field-business-name').getByRole('alert')).toHaveTextContent(REQUIRED_NAME)
            expect(onSubmit).not.toHaveBeenCalled()
        })

        it('TC-F01.05: Generate on an empty form focuses the business name field', async () => {
            // Arrange
            await renderLoadedForm()

            // Act
            clickGenerate()

            // Assert
            expect(nameInput()).toHaveFocus()
        })

        it('TC-F01.05: Generate focuses the first invalid field', async () => {
            // Arrange
            await renderLoadedForm()
            fireEvent.change(nameInput(), { target: { value: 'My Coffee Shop' } })

            // Act
            clickGenerate()

            // Assert — industry is the first invalid field; its first option card gets focus
            expect(screen.getByTestId('option-Food & Beverage')).toHaveFocus()
        })

        it('TC-F01.05: submitting the form with Enter also validates and does not submit', async () => {
            // Arrange
            const onSubmit = await renderLoadedForm()

            // Act
            fireEvent.submit(screen.getByTestId('left-body').querySelector('form')!)

            // Assert
            expect(field('field-business-name').getByRole('alert')).toHaveTextContent(REQUIRED_NAME)
            expect(onSubmit).not.toHaveBeenCalled()
        })

        it('TC-F23-028: a taken slug blocks Generate and focuses the slug field', async () => {
            // Arrange — the slug check answers "taken"; industries load as usual
            mockFetchWithSlugAvailable(false)
            const onSubmit = await renderLoadedForm()
            fireEvent.click(screen.getByTestId('option-Food & Beverage'))
            fillForm()
            expect(await screen.findByText('This address is taken')).toBeInTheDocument()

            // Act
            clickGenerate()

            // Assert
            expect(screen.queryByRole('alert')).not.toBeInTheDocument()
            expect(onSubmit).not.toHaveBeenCalled()
            expect(slugInput()).toHaveFocus()
        })

        it('TC-F23-028: clearing the name drops a stale "taken" answer so a recovered draft can still generate', async () => {
            // Arrange — recovered draft: SlugPicker skips its first check on every mount
            mockFetchWithSlugAvailable(false)
            const onSubmit = vi.fn()
            render(
                <BusinessInfoForm
                    initialValues={{ businessName: 'Test Biz', shortDescription: 'A small shop', industry: 'food', products: 'Cakes' }}
                    onSubmit={onSubmit}
                />,
            )
            await waitFor(() => expect(screen.getByTestId('option-Food & Beverage')).toBeInTheDocument())
            fireEvent.change(nameInput(), { target: { value: 'Other Name' } })
            expect(await screen.findByText('This address is taken')).toBeInTheDocument()

            // Act — clear the name (picker unmounts), type a new one (picker remounts, skips its check)
            fireEvent.change(nameInput(), { target: { value: '' } })
            fireEvent.change(nameInput(), { target: { value: 'Third Name' } })
            clickGenerate()

            // Assert
            expect(onSubmit).toHaveBeenCalledTimes(1)
            expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('slug')
        })

        it('TC-F01.13: new initial values (recovered draft) clear old field errors', async () => {
            // Arrange
            const { rerender } = render(<BusinessInfoForm onSubmit={vi.fn()} />)
            await waitFor(() => expect(screen.getByTestId('option-Food & Beverage')).toBeInTheDocument())
            clickGenerate()
            expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)

            // Act
            rerender(
                <BusinessInfoForm
                    initialValues={{ businessName: 'Test Biz', shortDescription: 'A small shop', industry: 'food', products: 'Cakes' }}
                    onSubmit={vi.fn()}
                />,
            )

            // Assert
            await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
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

// The suite above stubs the field primitives; these render the real ones to check what assistive tech gets.
describe('Builder field primitives — error accessibility', () => {
    it('TC-F01.05: BuilderField announces its error with role="alert"', async () => {
        // Arrange
        const { BuilderField } = await vi.importActual<typeof import('@/components/builder/fields/BuilderField')>(
            '@/components/builder/fields/BuilderField',
        )

        // Act
        render(<BuilderField error="Enter your business name" label="Business Name">child</BuilderField>)

        // Assert
        expect(screen.getByRole('alert')).toHaveTextContent('Enter your business name')
    })

    it('TC-F01.05: invalid text input and textarea expose aria-invalid, valid ones do not', async () => {
        // Arrange
        const { BuilderTextInput } = await vi.importActual<typeof import('@/components/builder/fields/BuilderTextInput')>(
            '@/components/builder/fields/BuilderTextInput',
        )
        const { BuilderTextarea } = await vi.importActual<typeof import('@/components/builder/fields/BuilderTextarea')>(
            '@/components/builder/fields/BuilderTextarea',
        )

        // Act
        render(
            <>
                <BuilderTextInput aria-label="bad-input" invalid />
                <BuilderTextarea aria-label="bad-textarea" invalid />
                <BuilderTextInput aria-label="ok-input" />
            </>,
        )

        // Assert
        expect(screen.getByLabelText('bad-input')).toHaveAttribute('aria-invalid', 'true')
        expect(screen.getByLabelText('bad-textarea')).toHaveAttribute('aria-invalid', 'true')
        expect(screen.getByLabelText('ok-input')).not.toHaveAttribute('aria-invalid')
    })
})
