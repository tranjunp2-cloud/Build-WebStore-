import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getBlockMeta: (type: string) => ({
            name: type.charAt(0).toUpperCase() + type.slice(1),
            icon: '🧩',
            variants: ['default', 'centered'],
            type,
        }),
    },
}))

import { SettingsPanel } from '@/components/editor/SettingsPanel'
import { I18nProvider } from '@/i18n'
import React from 'react'

const mockTheme = {
    primaryColor: '#0ea5e9',
    fontHeading: 'Outfit',
    fontBody: 'Inter',
    colorMode: 'dark',
}

const mockBlock = {
    blockType: 'hero',
    headline: 'Welcome to our site',
    subheadline: 'Build something great',
    variant: 'default',
}

const defaultProps = {
    block: mockBlock,
    blockIndex: 0,
    theme: mockTheme,
    onThemeChange: vi.fn(),
    onDeleteBlock: vi.fn(),
    onDuplicateBlock: vi.fn(),
    onBlockFieldChange: vi.fn(),
    onBlockUpdate: vi.fn(),
}

describe('SettingsPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Stub jsdom's missing Radix Select support (hasPointerCapture, scrollIntoView)
        if (!window.HTMLElement.prototype.hasPointerCapture) {
            window.HTMLElement.prototype.hasPointerCapture = () => false
        }
        if (!window.HTMLElement.prototype.scrollIntoView) {
            window.HTMLElement.prototype.scrollIntoView = () => {}
        }
    })

    // ── Empty state ──────────────────────────────────────────────────────

    it('defaults to Global site settings when no block is selected', () => {
        // Arrange & Act
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} /></I18nProvider>)

        // Assert
        expect(screen.getByText('Global site settings')).toBeInTheDocument()
        expect(screen.getByTestId('settings-panel')).toHaveClass('[contain:layout]')
    })

    it("[TC-F37-01-27][TC-F37-01-30] hides duplicate address/country fields and uses Contact Info address in the checklist", () => {
        // Arrange
        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...defaultProps}
                    block={null}
                    blockIndex={null}
                    siteName="Legacy Site"
                    siteStatus="draft"
                    site={{
                        id: "site-1",
                        name: "Legacy Site",
                        status: "draft",
                        contactInfo: {
                            address: "34 New Road",
                        },
                        localBusiness: {
                            city: "Kuala Lumpur",
                            state: "Kuala Lumpur",
                            postcode: "50450",
                            country: "   ",
                        },
                    }}
                />
            </I18nProvider>,
        )

        // Assert
        expect(screen.queryByTestId("settings-local-business-street-address")).not.toBeInTheDocument()
        expect(screen.queryByTestId("settings-local-business-country")).not.toBeInTheDocument()
        expect(screen.getByText("Address saved").closest("li")?.querySelector("svg")).not.toBeNull()
    })

    it('[TC-F37-01-26] restores the confirmed phone when a valid phone save fails', async () => {
        // Arrange
        let resolveSave: ((saved: boolean) => void) | undefined
        const saveResult = new Promise<boolean>((resolve) => {
            resolveSave = resolve
        })
        const onSiteSettingsChange = vi.fn(() => saveResult)
        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...defaultProps}
                    block={null}
                    blockIndex={null}
                    siteName="Phone Test Site"
                    siteStatus="draft"
                    site={{
                        id: 'site-1',
                        name: 'Phone Test Site',
                        status: 'draft',
                        contactInfo: { phone: '+60 12-111 1111' },
                    }}
                    onSiteSettingsChange={onSiteSettingsChange}
                />
            </I18nProvider>,
        )
        const phoneInput = screen.getByTestId('settings-contact-phone')
        const emailInput = screen.getByTestId('settings-contact-email')
        const addressInput = screen.getByTestId('settings-contact-address')

        // Act
        fireEvent.change(phoneInput, { target: { value: '  +60 12-222 2222  ' } })
        fireEvent.blur(phoneInput)

        // Assert
        await waitFor(() => {
            expect(onSiteSettingsChange).toHaveBeenCalledTimes(1)
            expect(phoneInput).toBeDisabled()
            expect(emailInput).toBeDisabled()
            expect(addressInput).toBeDisabled()
        })
        expect(onSiteSettingsChange).toHaveBeenCalledWith({
            contactInfo: { phone: '+60 12-222 2222' },
        })
        fireEvent.blur(phoneInput)
        fireEvent.blur(emailInput, { target: { value: 'queued@example.com' } })
        fireEvent.blur(addressInput, { target: { value: 'Queued address' } })
        expect(onSiteSettingsChange).toHaveBeenCalledTimes(1)
        resolveSave?.(false)
        await waitFor(() => {
            expect(phoneInput).toHaveValue('+60 12-111 1111')
            expect(phoneInput).not.toBeDisabled()
            expect(emailInput).not.toBeDisabled()
            expect(addressInput).not.toBeDisabled()
        })
    })

    it.each([
        {
            field: 'email',
            testId: 'settings-contact-email',
            confirmedValue: 'confirmed@example.com',
            failedValue: 'failed@example.com',
        },
        {
            field: 'address',
            testId: 'settings-contact-address',
            confirmedValue: 'Confirmed address',
            failedValue: 'Failed address',
        },
    ] as const)('[TC-F37-01-26] restores confirmed $field and sends only that field when its save fails', async ({
        field,
        testId,
        confirmedValue,
        failedValue,
    }) => {
        // Arrange
        let resolveSave: ((saved: boolean) => void) | undefined
        const saveResult = new Promise<boolean>((resolve) => {
            resolveSave = resolve
        })
        const onSiteSettingsChange = vi.fn(() => saveResult)
        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...defaultProps}
                    block={null}
                    blockIndex={null}
                    siteName="Contact Test Site"
                    siteStatus="draft"
                    site={{
                        id: 'site-1',
                        name: 'Contact Test Site',
                        status: 'draft',
                        contactInfo: {
                            phone: '+60 12\t345 6789',
                            email: field === 'email' ? confirmedValue : 'confirmed@example.com',
                            address: field === 'address' ? confirmedValue : 'Confirmed address',
                        },
                    }}
                    onSiteSettingsChange={onSiteSettingsChange}
                />
            </I18nProvider>,
        )
        const input = screen.getByTestId(testId)
        const phoneInput = screen.getByTestId('settings-contact-phone')
        const emailInput = screen.getByTestId('settings-contact-email')
        const addressInput = screen.getByTestId('settings-contact-address')

        // Act
        fireEvent.change(input, { target: { value: failedValue } })
        fireEvent.blur(input)

        // Assert
        await waitFor(() => {
            expect(onSiteSettingsChange).toHaveBeenCalledTimes(1)
            expect(phoneInput).toBeDisabled()
            expect(emailInput).toBeDisabled()
            expect(addressInput).toBeDisabled()
        })
        expect(onSiteSettingsChange).toHaveBeenCalledWith({
            contactInfo: { [field]: failedValue },
        })
        resolveSave?.(false)
        await waitFor(() => {
            expect(input).toHaveValue(confirmedValue)
            expect(phoneInput).not.toBeDisabled()
            expect(emailInput).not.toBeDisabled()
            expect(addressInput).not.toBeDisabled()
        })
    })

    it('[TC-F37-01-26] canonicalizes the address before a successful save', async () => {
        // Arrange
        const onSiteSettingsChange = vi.fn(() => true)
        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...defaultProps}
                    block={null}
                    blockIndex={null}
                    siteName="Address Test Site"
                    siteStatus="draft"
                    site={{
                        id: 'site-1',
                        name: 'Address Test Site',
                        status: 'draft',
                        contactInfo: { address: 'Old address' },
                    }}
                    onSiteSettingsChange={onSiteSettingsChange}
                />
            </I18nProvider>,
        )
        const addressInput = screen.getByTestId('settings-contact-address')

        // Act
        fireEvent.change(addressInput, { target: { value: '  <b>123 Main St</b>  ' } })
        fireEvent.blur(addressInput)

        // Assert
        await waitFor(() => {
            expect(onSiteSettingsChange).toHaveBeenCalledWith({
                contactInfo: { address: '123 Main St' },
            })
        })
        expect(addressInput).toHaveValue('123 Main St')
    })

    it('[TC-F37-01-26] canonicalizes the email before a successful save', async () => {
        // Arrange
        const onSiteSettingsChange = vi.fn(() => true)
        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...defaultProps}
                    block={null}
                    blockIndex={null}
                    siteName="Email Test Site"
                    siteStatus="draft"
                    site={{
                        id: 'site-1',
                        name: 'Email Test Site',
                        status: 'draft',
                        contactInfo: { email: 'old@example.com' },
                    }}
                    onSiteSettingsChange={onSiteSettingsChange}
                />
            </I18nProvider>,
        )
        const emailInput = screen.getByTestId('settings-contact-email')

        // Act
        fireEvent.change(emailInput, { target: { value: '  <b>a@b.com</b>  ' } })
        fireEvent.blur(emailInput)

        // Assert
        await waitFor(() => {
            expect(onSiteSettingsChange).toHaveBeenCalledWith({
                contactInfo: { email: 'a@b.com' },
            })
        })
        expect(emailInput).toHaveValue('a@b.com')
    })

    it('[TC-F37-01-26] keeps contact fields locked when the panel remounts during a parent save', () => {
        // Arrange
        const panel = (
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...defaultProps}
                    block={null}
                    blockIndex={null}
                    siteName="Pending Contact Site"
                    siteStatus="draft"
                    site={{
                        id: 'site-1',
                        name: 'Pending Contact Site',
                        status: 'draft',
                        contactInfo: {
                            phone: '+60 12-111 1111',
                            email: 'confirmed@example.com',
                            address: 'Confirmed address',
                        },
                    }}
                    isContactSavePending
                />
            </I18nProvider>
        )
        const firstMount = render(panel)

        // Act
        firstMount.unmount()
        render(panel)

        // Assert
        expect(screen.getByTestId('settings-contact-phone')).toBeDisabled()
        expect(screen.getByTestId('settings-contact-email')).toBeDisabled()
        expect(screen.getByTestId('settings-contact-address')).toBeDisabled()
    })

    // ── Block info header ────────────────────────────────────────────────

    it('renders block name and index in header', () => {
        // Arrange & Act
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} /></I18nProvider>)

        // Assert
        expect(screen.getByText(/Hero/)).toBeInTheDocument()
        expect(screen.getByText('#1')).toBeInTheDocument()
    })

    // ── Variant switcher ─────────────────────────────────────────────────

    it('renders variant buttons for blocks with multiple variants', () => {
        // Arrange & Act
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} /></I18nProvider>)

        // Assert
        expect(screen.getByText('Default')).toBeInTheDocument()
        expect(screen.getByText('Centered')).toBeInTheDocument()
    })

    it('clicking a variant calls onBlockFieldChange', () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} /></I18nProvider>)

        // Act
        fireEvent.click(screen.getByText('Centered'))

        // Assert
        expect(defaultProps.onBlockFieldChange).toHaveBeenCalledWith(0, 'variant', 'centered')
    })

    // ── TC-F09.253: Products Grid category filter editor control ─────────
    describe('[TC-F09.253] Products Grid category filter editor control', () => {
        it('renders checked state with semantic editor theme tokens', () => {
            // Arrange
            const onBlockFieldChange = vi.fn()
            render(
                <I18nProvider defaultLocale="en">
                    <SettingsPanel
                        {...defaultProps}
                        block={{ blockType: 'products-grid', headline: 'Products', variant: 'grid-3', showCategoryFilter: true }}
                        onBlockFieldChange={onBlockFieldChange}
                    />
                </I18nProvider>,
            )

            // Act
            const checkbox = screen.getByRole('checkbox', { name: 'Show category filter' })
            const row = checkbox.closest('label')

            // Assert
            expect(checkbox).toBeChecked()
            expect(row).not.toBeNull()
            expect(row).toHaveClass('border-[var(--editor-border)]')
            expect(row).toHaveClass('border-solid')
            expect(row).toHaveClass('bg-[var(--editor-surface-elevated)]')
            expect(row).toHaveClass('text-[var(--editor-text)]')
            expect(checkbox).toHaveClass('border-[hsl(var(--input-border))]')
            expect(checkbox).toHaveClass('border-solid')
            expect(checkbox).toHaveClass('bg-[var(--editor-surface-deep)]')
            expect(checkbox).toHaveClass('data-[state=checked]:bg-[hsl(var(--primary))]')
        })

        it('writes the next boolean value through onBlockFieldChange', () => {
            // Arrange
            const onBlockFieldChange = vi.fn()
            render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={{ blockType: 'products-grid', headline: 'Products', variant: 'grid-3', showCategoryFilter: false }} onBlockFieldChange={onBlockFieldChange} /></I18nProvider>)
            const checkbox = screen.getByRole('checkbox', { name: 'Show category filter' })

            // Act
            fireEvent.click(checkbox)

            // Assert
            expect(onBlockFieldChange).toHaveBeenCalledWith(0, 'showCategoryFilter', true)
        })
    })

    // ── Text fields ──────────────────────────────────────────────────────

    it('renders headline input with default value', () => {
        // Arrange & Act
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} /></I18nProvider>)

        // Assert
        const input = screen.getByDisplayValue('Welcome to our site')
        expect(input).toBeInTheDocument()
    })

    it('headline onBlur calls onBlockFieldChange', () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} /></I18nProvider>)
        const input = screen.getByDisplayValue('Welcome to our site')

        // Act
        fireEvent.blur(input, { target: { value: 'New Headline' } })

        // Assert
        expect(defaultProps.onBlockFieldChange).toHaveBeenCalledWith(0, 'headline', 'New Headline')
    })

    // ── Theme settings ───────────────────────────────────────────────────

    it('renders theme section with primary color picker', () => {
        // Arrange & Act — render without block to stay on Global tab
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} blockIndex={null} /></I18nProvider>)

        // Assert
        expect(screen.getByLabelText('Primary colour picker')).toBeInTheDocument()
    })

    it('color picker change calls onThemeChange with primaryColor', () => {
        // Arrange — render without block to stay on Global tab
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} blockIndex={null} /></I18nProvider>)
        const colorPicker = screen.getByLabelText('Primary colour picker')

        // Act
        fireEvent.change(colorPicker, { target: { value: '#22c55e' } })

        // Assert
        expect(defaultProps.onThemeChange).toHaveBeenCalledWith('primaryColor', '#22c55e')
    })

    it('renders heading font selector with current value', () => {
        // Arrange & Act
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} blockIndex={null} /></I18nProvider>)

        // Assert — FontSelect renders a Radix Select trigger with role="combobox"
        const headingLabel = screen.getByText('Heading font')

        // F37 US-01 added the Local Business accordion's own comboboxes (state/
        // category/priceRange <Select>s) earlier in the Global tab, so font
        // selectors can no longer be found by absolute index — scope to the
        // combobox rendered right next to the "Heading font" label instead.
        const headingFontCombobox = headingLabel.parentElement!.querySelector('[role="combobox"]') as HTMLElement
        expect(headingFontCombobox.textContent).toContain('Outfit')
    })

    it('changing heading font calls onThemeChange', async () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} blockIndex={null} /></I18nProvider>)

        // Find the heading font selector, scoped by its label (see note above)
        const headingLabel = screen.getByText('Heading font')
        const headingFontCombobox = headingLabel.parentElement!.querySelector('[role="combobox"]') as HTMLElement
        expect(headingFontCombobox.textContent).toContain('Outfit')

        // Act — click to open the Radix Select listbox
        fireEvent.click(headingFontCombobox)

        // Find the "Playfair Display" option in the portal and click it
        await waitFor(() => {
            const option = screen.getByRole('option', { name: /Playfair Display/i })
            expect(option).toBeInTheDocument()
        })
        const option = screen.getByRole('option', { name: /Playfair Display/i })
        fireEvent.click(option)

        // Assert
        expect(defaultProps.onThemeChange).toHaveBeenCalledWith('fontHeading', 'Playfair Display')
    })

    it('renders body font selector with current value', () => {
        // Arrange & Act
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} blockIndex={null} /></I18nProvider>)

        // Assert — FontSelect renders a Radix Select trigger with role="combobox"
        const bodyLabel = screen.getByText('Body font')

        // Scope by label (see "renders heading font selector" test note above) —
        // the Local Business accordion's <Select>s shift absolute combobox indices.
        const bodyFontCombobox = bodyLabel.parentElement!.querySelector('[role="combobox"]') as HTMLElement
        expect(bodyFontCombobox.textContent).toContain('Inter')
    })

    it('changing body font calls onThemeChange', async () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} blockIndex={null} /></I18nProvider>)

        // Find the body font selector, scoped by its label (see note above)
        const bodyLabel = screen.getByText('Body font')
        const bodyFontCombobox = bodyLabel.parentElement!.querySelector('[role="combobox"]') as HTMLElement
        expect(bodyFontCombobox.textContent).toContain('Inter')

        // Act — click to open the Radix Select listbox
        fireEvent.click(bodyFontCombobox)

        // Find the "DM Sans" option in the portal and click it
        await waitFor(() => {
            const option = screen.getByRole('option', { name: /DM Sans/i })
            expect(option).toBeInTheDocument()
        })
        const option = screen.getByRole('option', { name: /DM Sans/i })
        fireEvent.click(option)

        // Assert
        expect(defaultProps.onThemeChange).toHaveBeenCalledWith('fontBody', 'DM Sans')
    })

    // ── Color mode ───────────────────────────────────────────────────────

    it('renders dark/light color mode buttons', () => {
        // Arrange & Act
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} blockIndex={null} /></I18nProvider>)

        // Assert
        expect(screen.getByText('Dark')).toBeInTheDocument()
        expect(screen.getByText('Light')).toBeInTheDocument()
    })

    it('infers page link type and current page value for legacy menu links without explicit type', () => {
        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...defaultProps}
                    block={null}
                    blockIndex={null}
                    headerBlock={{
                        blockType: 'navigation',
                        links: [{ label: 'About', url: '/about' }],
                    }}
                    pages={[
                        { id: 'home', title: 'Homepage', slug: '/', status: 'published', isVisible: true, updatedAt: '' },
                        { id: 'about', title: 'About', slug: 'about', status: 'published', isVisible: true, updatedAt: '' },
                    ]}
                    requestedTab={{ tab: 'menu', key: 1 }}
                />
            </I18nProvider>
        )

        fireEvent.click(screen.getByRole('button', { name: 'Edit link' }))

        const selects = screen.getAllByRole('combobox')
        expect(selects[0]).toHaveValue('page')
        expect(selects[1]).toHaveValue('/about')
    })

    it('clicking Light mode calls onThemeChange with colorMode', () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} blockIndex={null} /></I18nProvider>)

        // Act
        fireEvent.click(screen.getByText('Light'))

        // Assert
        expect(defaultProps.onThemeChange).toHaveBeenCalledWith('colorMode', 'light')
    })

    // ── Theme not provided ───────────────────────────────────────────────

    it('does not render theme section when theme is undefined', () => {
        // Arrange & Act
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} theme={undefined} /></I18nProvider>)

        // Assert
        expect(screen.queryByLabelText('Primary colour picker')).not.toBeInTheDocument()
    })
})

// ── GH-1024 Phase 02: SettingsPanel CRUD — feature-comparison ───────────

describe('SettingsPanel CRUD — feature-comparison [TC-F08-CRUD-FEATCMP]', () => {
    it('[TC-F08-CRUD-FEATCMP-ADD-PRODUCT-SYNC] adding a product extends all features values arrays', () => {
        // Arrange
        const fcBlock = {
            blockType: 'feature-comparison',
            products: [{ name: 'Basic', highlighted: false }],
            features: [{ name: 'Storage', values: [true] }],
        }
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={fcBlock} /></I18nProvider>)

        // Act — stepper increment button adds a product
        fireEvent.click(screen.getByLabelText('Increase product count'))

        // Assert: new product appended, each feature gains a false value column
        expect(defaultProps.onBlockUpdate).toHaveBeenCalledWith(0, {
            products: [{ name: 'Basic', highlighted: false }, { name: 'New Product', highlighted: false }],
            features: [{ name: 'Storage', values: [true, false] }],
        })
    })

    it('[TC-F08-CRUD-FEATCMP-REMOVE-PRODUCT-SYNC] removing a product trims all features values arrays', () => {
        // Arrange
        const fcBlock = {
            blockType: 'feature-comparison',
            products: [{ name: 'Basic', highlighted: false }, { name: 'Pro', highlighted: true }],
            features: [{ name: 'Storage', values: [true, false] }],
        }
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={fcBlock} /></I18nProvider>)

        // Act — stepper decrement removes the last product
        fireEvent.click(screen.getByLabelText('Decrease product count'))

        // Assert: last product (Pro) removed, last feature value trimmed
        expect(defaultProps.onBlockUpdate).toHaveBeenCalledWith(0, {
            products: [{ name: 'Basic', highlighted: false }],
            features: [{ name: 'Storage', values: [true] }],
        })
    })
})

// ── GH-1024 Phase 03: SettingsPanel CRUD — menu-food ────────────────────

describe('SettingsPanel CRUD — menu-food [TC-F08-CRUD-MENUFOOD]', () => {
    const mfItem = { name: 'Burger', description: 'Juicy', price: '15.00', currency: 'RM', tag: 'Popular', image: null }
    const mfCat = { name: 'Burgers', items: [mfItem] }
    const menuFoodBlock = { blockType: 'menu-food', categories: [mfCat] }

    it('[TC-F08-CRUD-MENUFOOD-CAT-ADD] clicking Add Category appends default category', () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={menuFoodBlock} /></I18nProvider>)

        // Act
        fireEvent.click(screen.getByText('+ Add category'))

        // Assert
        expect(defaultProps.onBlockUpdate).toHaveBeenCalledWith(0, {
            categories: [mfCat, { name: 'New Category', items: [] }],
        })
    })

    it('[TC-F08-CRUD-MENUFOOD-CAT-REMOVE] clicking remove on category removes it', () => {
        // Arrange — no items so only one category remove button
        const emptyCatBlock = { blockType: 'menu-food', categories: [{ name: 'Burgers', items: [] }] }
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={emptyCatBlock} /></I18nProvider>)

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Remove category 1' }))

        // Assert
        expect(defaultProps.onBlockUpdate).toHaveBeenCalledWith(0, { categories: [] })
    })

    it('[TC-F08-CRUD-MENUFOOD-ITEM-ADD] clicking Add Item appends default menu item inside category', () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={menuFoodBlock} /></I18nProvider>)

        // Act
        fireEvent.click(screen.getByText('+ Add item'))

        // Assert
        expect(defaultProps.onBlockUpdate).toHaveBeenCalledWith(0, {
            categories: [{ ...mfCat, items: [mfItem, { name: 'New Item', description: '', price: '', currency: 'RM', tag: '', image: null }] }],
        })
    })

    it('[TC-F08-CRUD-MENUFOOD-ITEM-EDIT] onBlur on item name updates nested item via onBlockUpdate', () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={menuFoodBlock} /></I18nProvider>)
        const input = screen.getByDisplayValue('Burger')

        // Act
        fireEvent.blur(input, { target: { value: 'Double Burger' } })

        // Assert
        expect(defaultProps.onBlockUpdate).toHaveBeenCalledWith(0, {
            categories: [{ ...mfCat, items: [{ ...mfItem, name: 'Double Burger' }] }],
        })
    })

    it('[TC-F08-CRUD-MENUFOOD-ITEM-REMOVE] clicking remove on item removes it from category', () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={menuFoodBlock} /></I18nProvider>)

        // Act — item remove button (aria-label distinguishes it from category remove)
        fireEvent.click(screen.getByRole('button', { name: 'Remove item 1 from category 1' }))

        // Assert: item removed, category remains with empty items
        expect(defaultProps.onBlockUpdate).toHaveBeenCalledWith(0, {
            categories: [{ ...mfCat, items: [] }],
        })
    })
})

// ── TC-F37-02-29/30: dependent Local Business schema subtype ───────────

describe('[TC-F37-02-29/30] SettingsPanel Local Business schema subtype', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Arrange Radix Select's browser APIs for focused runs of this describe.
        if (!window.HTMLElement.prototype.hasPointerCapture) {
            window.HTMLElement.prototype.hasPointerCapture = () => false
        }
        if (!window.HTMLElement.prototype.scrollIntoView) {
            window.HTMLElement.prototype.scrollIntoView = () => {}
        }
    })

    const renderLocalBusinessSettings = (
        localBusiness: NonNullable<NonNullable<React.ComponentProps<typeof SettingsPanel>['site']>['localBusiness']>,
        onSiteSettingsChange = vi.fn(),
        isLocalBusinessSaveLocked = false,
    ) => {
        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...defaultProps}
                    block={null}
                    blockIndex={null}
                    site={{
                        id: 'site-f37',
                        name: 'F37 Bakery',
                        status: 'draft',
                        localBusiness,
                    }}
                    siteName="F37 Bakery"
                    siteStatus="draft"
                    onSiteSettingsChange={onSiteSettingsChange}
                    isLocalBusinessSaveLocked={isLocalBusinessSaveLocked}
                    fullWidth
                />
            </I18nProvider>,
        )
        return onSiteSettingsChange
    }

    it('[TC-F37-02-29] disables the labelled subtype select before category without saving on hydration', () => {
        // Arrange
        const onSiteSettingsChange = vi.fn()

        // Act
        renderLocalBusinessSettings({}, onSiteSettingsChange)

        // Assert
        expect(screen.getByRole('combobox', { name: 'Schema subtype' })).toBeDisabled()
        expect(screen.getByText('Select a business category first.')).toBeVisible()
        expect(onSiteSettingsChange).not.toHaveBeenCalled()
    })

    it('[TC-F37-02-29] disables subtype for the generic LocalBusiness category with an explanation', () => {
        // Arrange
        const onSiteSettingsChange = vi.fn()

        // Act
        renderLocalBusinessSettings({ businessCategory: 'localBusiness' }, onSiteSettingsChange)

        // Assert
        expect(screen.getByRole('combobox', { name: 'Schema subtype' })).toBeDisabled()
        expect(screen.getByText(
            'The generic Local Business category uses LocalBusiness directly and has no schema subtype.',
        )).toBeVisible()
        expect(onSiteSettingsChange).not.toHaveBeenCalled()
    })


    it('[TC-F37-02-48] disables the LocalBusiness form and keeps a persistent reload alert after an unknown save', () => {
        // Arrange
        const onSiteSettingsChange = vi.fn()

        // Act
        renderLocalBusinessSettings({
            businessCategory: 'store',
            schemaSubtype: 'Store',
            streetAddress: '1 Confirmed Street',
        }, onSiteSettingsChange, true)

        // Assert
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Local business editing is temporarily locked. Reload the editor to confirm the last save before continuing.',
        )
        expect(screen.getByTestId('settings-local-business-state')).toBeDisabled()
        expect(screen.getByRole('combobox', { name: 'Business Category' })).toBeDisabled()
        expect(screen.getByRole('combobox', { name: 'Schema subtype' })).toBeDisabled()
        expect(onSiteSettingsChange).not.toHaveBeenCalled()
    })

    it('[TC-F37-02-29] describes both generic unavailability and an incompatible legacy subtype', () => {
        // Arrange

        // Act
        renderLocalBusinessSettings({
            businessCategory: 'localBusiness',
            schemaSubtype: 'Store',
        })

        // Assert
        expect(screen.getByRole('combobox', { name: 'Schema subtype' })).toHaveAttribute(
            'aria-describedby',
            expect.stringContaining('local-business-schema-subtype-unavailable-hint'),
        )
        expect(screen.getByRole('combobox', { name: 'Schema subtype' })).toHaveAttribute(
            'aria-describedby',
            expect.stringContaining('local-business-schema-subtype-validation'),
        )
    })
    it('[TC-F37-02-29] exposes only compatible subtype options in the 375px-safe full-width layout', async () => {
        // Arrange
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
        renderLocalBusinessSettings({ businessCategory: 'foodEstablishment' })
        const subtypeSelect = screen.getByRole('combobox', { name: 'Schema subtype' })

        // Act
        fireEvent.click(subtypeSelect)

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('option', { name: 'Bakery' })).toBeInTheDocument()
        })
        expect(screen.getByRole('option', { name: 'Restaurant' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Cafe or coffee shop' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Fast-food restaurant' })).toBeInTheDocument()
        expect(screen.queryByRole('option', { name: 'Store / Retail' })).not.toBeInTheDocument()
        expect(subtypeSelect).toHaveClass('w-full')
        expect(screen.getByRole('listbox')).toHaveClass('max-w-[calc(100vw-2rem)]')
    })

    it('[TC-F37-02-29] auto-selects the sole subtype in exactly one atomic category save', async () => {
        // Arrange
        const onSiteSettingsChange = renderLocalBusinessSettings({})
        const categorySelect = screen.getByRole('combobox', { name: 'Business Category' })

        // Act
        fireEvent.click(categorySelect)
        fireEvent.click(await screen.findByRole('option', { name: 'Restaurant' }))

        // Assert
        await waitFor(() => {
            expect(onSiteSettingsChange).toHaveBeenCalledTimes(1)
        })
        expect(onSiteSettingsChange).toHaveBeenCalledWith({
            localBusiness: {
                businessCategory: 'restaurant',
                schemaSubtype: 'Restaurant',
            },
        })
    })

    it('[TC-F37-02-30] preserves a compatible subtype in exactly one atomic category save', async () => {
        // Arrange
        const onSiteSettingsChange = renderLocalBusinessSettings({
            businessCategory: 'foodEstablishment',
            schemaSubtype: 'Restaurant',
        })
        const categorySelect = screen.getByRole('combobox', { name: 'Business Category' })

        // Act
        fireEvent.click(categorySelect)
        fireEvent.click(await screen.findByRole('option', { name: 'Restaurant' }))

        // Assert
        await waitFor(() => {
            expect(onSiteSettingsChange).toHaveBeenCalledTimes(1)
        })
        expect(onSiteSettingsChange).toHaveBeenCalledWith({
            localBusiness: {
                businessCategory: 'restaurant',
                schemaSubtype: 'Restaurant',
            },
        })
    })

    it('[TC-F37-02-30] clears an incompatible subtype in exactly one atomic category save', async () => {
        // Arrange
        const onSiteSettingsChange = renderLocalBusinessSettings({
            businessCategory: 'foodEstablishment',
            schemaSubtype: 'Bakery',
        })
        const categorySelect = screen.getByRole('combobox', { name: 'Business Category' })

        // Act
        fireEvent.click(categorySelect)
        fireEvent.click(await screen.findByRole('option', { name: 'Health & Beauty' }))

        // Assert
        await waitFor(() => {
            expect(onSiteSettingsChange).toHaveBeenCalledTimes(1)
        })
        expect(onSiteSettingsChange).toHaveBeenCalledWith({
            localBusiness: {
                businessCategory: 'healthAndBeautyBusiness',
                schemaSubtype: null,
            },
        })
    })

    it("[TC-F37-04-12][TC-F37-10-04] normalizes a hydrated OG image while autosaving Search verification", async () => {
        // Arrange
        const onSiteSettingsChange = vi.fn()
        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...defaultProps}
                    block={null}
                    blockIndex={null}
                    siteName="SEO Site"
                    siteStatus="draft"
                    site={{
                        id: "site-1",
                        name: "SEO Site",
                        status: "draft",
                        seo: {
                            googleVerificationToken: "old-token",
                            ogImage: {
                                id: "media-42",
                                url: "https://cdn.example.test/og-image.jpg",
                            } as unknown as string,
                        },
                    }}
                    requestedTab={{ tab: "seo", section: "searchVerification", key: 1 }}
                    onSiteSettingsChange={onSiteSettingsChange}
                />
            </I18nProvider>,
        )

        // Act
        const input = await screen.findByTestId("settings-google-verification-token")
        const labelledInput = await screen.findByLabelText("Search verification")
        expect(labelledInput).toBe(input)
        await waitFor(() => expect(input).toHaveFocus())
        fireEvent.blur(input, { target: { value: "  new-token  " } })

        // Assert
        expect(onSiteSettingsChange.mock.calls).toEqual([[
            { seo: { googleVerificationToken: "new-token", ogImage: "media-42" } },
        ]])
    })

    it('[TC-F37-04-12] opens Contact Info and focuses the canonical address field', async () => {
        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...defaultProps}
                    block={null}
                    blockIndex={null}
                    siteName="Contact Site"
                    siteStatus="draft"
                    site={{ id: "site-1", name: "Contact Site", status: "draft" }}
                    requestedTab={{ tab: "global", section: "contact", focus: "address", key: 2 }}
                />
            </I18nProvider>,
        )

        const address = await screen.findByTestId("settings-contact-address")

        await waitFor(() => expect(address).toHaveFocus())
    })

    it("[TC-F37-04-12] expands Local Business and focuses the address target", async () => {
        // Arrange
        render(
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    {...defaultProps}
                    block={null}
                    blockIndex={null}
                    siteName="Local Site"
                    siteStatus="draft"
                    site={{ id: "site-1", name: "Local Site", status: "draft" }}
                    requestedTab={{ tab: "global", section: "localBusiness", focus: "address", key: 2 }}
                />
            </I18nProvider>,
        )

        // Act
        const state = await screen.findByTestId("settings-local-business-state")

        // Assert
        await waitFor(() => expect(state).toHaveFocus())
    })

    it("[TC-F37-04-12] focuses Local Business State after its geo options finish loading", async () => {
        // Arrange
        let resolveStates: ((response: Response) => void) | undefined
        const originalFetch = global.fetch
        global.fetch = vi.fn(() => new Promise<Response>((resolve) => {
            resolveStates = resolve
        })) as unknown as typeof fetch

        try {
            render(
                <I18nProvider defaultLocale="en">
                    <SettingsPanel
                        {...defaultProps}
                        block={null}
                        blockIndex={null}
                        siteName="Local Site"
                        siteStatus="draft"
                        site={{ id: "site-1", name: "Local Site", status: "draft" }}
                        requestedTab={{ tab: "global", section: "localBusiness", focus: "address", key: 3 }}
                    />
                </I18nProvider>,
            )

            const state = await screen.findByTestId("settings-local-business-state")
            expect(state).toBeDisabled()

            // Act — ensure the initial navigation focus attempt happens while the control is disabled.
            await new Promise(resolve => setTimeout(resolve, 150))
            await act(async () => {
                resolveStates?.(new Response(JSON.stringify([]), {
                    headers: { "Content-Type": "application/json" },
                }))
            })

            // Assert
            await waitFor(() => expect(state).toHaveFocus())
        } finally {
            global.fetch = originalFetch
        }
    })
})
