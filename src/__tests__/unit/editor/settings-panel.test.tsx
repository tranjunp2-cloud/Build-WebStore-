import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

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
    })

    // ── Empty state ──────────────────────────────────────────────────────

    it('defaults to Global Site Settings when no block is selected', () => {
        // Arrange & Act
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} /></I18nProvider>)

        // Assert
        expect(screen.getByText('Global Site Settings')).toBeInTheDocument()
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
        expect(screen.getByText('default')).toBeInTheDocument()
        expect(screen.getByText('centered')).toBeInTheDocument()
    })

    it('clicking a variant calls onBlockFieldChange', () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} /></I18nProvider>)

        // Act
        fireEvent.click(screen.getByText('centered'))

        // Assert
        expect(defaultProps.onBlockFieldChange).toHaveBeenCalledWith(0, 'variant', 'centered')
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
        expect(screen.getByLabelText('Primary color picker')).toBeInTheDocument()
    })

    it('color picker change calls onThemeChange with primaryColor', () => {
        // Arrange — render without block to stay on Global tab
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} blockIndex={null} /></I18nProvider>)
        const colorPicker = screen.getByLabelText('Primary color picker')

        // Act
        fireEvent.change(colorPicker, { target: { value: '#22c55e' } })

        // Assert
        expect(defaultProps.onThemeChange).toHaveBeenCalledWith('primaryColor', '#22c55e')
    })

    it('renders heading font selector with current value', () => {
        // Arrange & Act
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} blockIndex={null} /></I18nProvider>)

        // Assert
        expect(screen.getByText('Heading Font')).toBeInTheDocument()
        const selects = screen.getAllByRole('combobox')
        // First select is heading font
        expect(selects[0]).toHaveValue('Outfit')
    })

    it('changing heading font calls onThemeChange', () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} blockIndex={null} /></I18nProvider>)
        const selects = screen.getAllByRole('combobox')

        // Act
        fireEvent.change(selects[0], { target: { value: 'Playfair Display' } })

        // Assert
        expect(defaultProps.onThemeChange).toHaveBeenCalledWith('fontHeading', 'Playfair Display')
    })

    it('renders body font selector with current value', () => {
        // Arrange & Act
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} blockIndex={null} /></I18nProvider>)

        // Assert
        expect(screen.getByText('Body Font')).toBeInTheDocument()
        const selects = screen.getAllByRole('combobox')
        // Second select is body font
        expect(selects[1]).toHaveValue('Inter')
    })

    it('changing body font calls onThemeChange', () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} blockIndex={null} /></I18nProvider>)
        const selects = screen.getAllByRole('combobox')

        // Act
        fireEvent.change(selects[1], { target: { value: 'DM Sans' } })

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

    it('clicking Light mode calls onThemeChange with colorMode', () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} block={null} blockIndex={null} /></I18nProvider>)

        // Act
        fireEvent.click(screen.getByText('Light'))

        // Assert
        expect(defaultProps.onThemeChange).toHaveBeenCalledWith('colorMode', 'light')
    })

    // ── Block actions ────────────────────────────────────────────────────

    it('duplicate button calls onDuplicateBlock', () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} /></I18nProvider>)

        // Act
        fireEvent.click(screen.getByText(/duplicate/i))

        // Assert
        expect(defaultProps.onDuplicateBlock).toHaveBeenCalledWith(0)
    })

    it('delete button calls onDeleteBlock', () => {
        // Arrange
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} /></I18nProvider>)

        // Act
        fireEvent.click(screen.getByText(/delete/i))

        // Assert
        expect(defaultProps.onDeleteBlock).toHaveBeenCalledWith(0)
    })

    // ── Theme not provided ───────────────────────────────────────────────

    it('does not render theme section when theme is undefined', () => {
        // Arrange & Act
        render(<I18nProvider defaultLocale="en"><SettingsPanel {...defaultProps} theme={undefined} /></I18nProvider>)

        // Assert
        expect(screen.queryByLabelText('Primary color picker')).not.toBeInTheDocument()
    })
})
