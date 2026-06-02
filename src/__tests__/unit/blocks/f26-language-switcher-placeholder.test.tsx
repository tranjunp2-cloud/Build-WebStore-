import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NavLangSwitcherPlaceholder } from '@/blocks/navigation/language-switcher-placeholder'
import { useEditorStore } from '@/store/editorStore'

/**
 * TC-ID: F26-07-01 — Language Switcher Placeholder Component
 *
 * Feature: F26 — Project Content Localization / Multilingual Editor
 * Story: F26-07 — Language Switcher dropdown in Navigation Header
 *
 * Dropdown: shows active locale + chevron; click reveals EN/BM options.
 * Each option sends SWITCH_LOCALE postMessage to parent editor.
 * Dropdown pattern scales to 3+ locales (ZH, TH, ID...) — F27 wires full list.
 */

beforeEach(() => {
    useEditorStore.getState().reset()
})

describe('NavLangSwitcherPlaceholder', () => {
    it('renders trigger button with active locale flag and chevron', () => {
        // TC-ID: F26-07-01-render-trigger
        render(<NavLangSwitcherPlaceholder />)

        const container = screen.getByLabelText('Language switcher')
        expect(container).toBeInTheDocument()

        // Trigger button shows flag (SVG via country-flag-icons — cross-platform; Windows
        // lacks emoji flag glyphs) + the locale short code (EN by default). The flag SVG
        // carries a <title> with the short code; the chevron SVG has none.
        const trigger = screen.getByRole('button')
        expect(trigger).toBeInTheDocument()
        expect(screen.getByTitle('EN')).toBeInTheDocument()
        expect(trigger.textContent).toContain('EN')

        // ChevronDown SVG present
        const svg = container.querySelector('svg')
        expect(svg).toBeInTheDocument()
    })

    it('dropdown is closed by default', () => {
        // TC-ID: F26-07-01-closed-default
        render(<NavLangSwitcherPlaceholder />)

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        const trigger = screen.getByRole('button')
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('opens dropdown on hover', () => {
        // TC-ID: F26-07-01-open-on-hover
        render(<NavLangSwitcherPlaceholder />)

        fireEvent.mouseEnter(screen.getByLabelText('Language switcher'))

        expect(screen.getByRole('listbox')).toBeInTheDocument()
        expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    })

    it('shows both locale flag options inside dropdown', () => {
        // TC-ID: F26-07-01-dropdown-options
        render(<NavLangSwitcherPlaceholder />)
        fireEvent.mouseEnter(screen.getByLabelText('Language switcher'))

        const options = screen.getAllByRole('option')
        expect(options).toHaveLength(2)
        // Each option renders its flag as an SVG (country-flag-icons) + full language name.
        expect(options[0].querySelector('svg')).toBeInTheDocument()
        expect(options[1].querySelector('svg')).toBeInTheDocument()
        expect(options[0].textContent).toContain('English')
        expect(options[1].textContent).toContain('Malay')
    })

    it('active option has aria-selected=true', () => {
        // TC-ID: F26-07-01-active-aria-selected
        useEditorStore.getState().setActiveLocale('en')
        render(<NavLangSwitcherPlaceholder />)
        fireEvent.mouseEnter(screen.getByLabelText('Language switcher'))

        const options = screen.getAllByRole('option')
        expect(options[0]).toHaveAttribute('aria-selected', 'true')   // EN
        expect(options[1]).toHaveAttribute('aria-selected', 'false')  // BM
    })

    it('sends SWITCH_LOCALE postMessage and closes dropdown on option select', () => {
        // TC-ID: F26-07-01-postmessage-on-select
        const messages: unknown[] = []
        const orig = window.parent.postMessage.bind(window.parent)
        window.parent.postMessage = (msg: unknown) => messages.push(msg)

        render(<NavLangSwitcherPlaceholder />)
        fireEvent.mouseEnter(screen.getByLabelText('Language switcher')) // hover open
        fireEvent.click(screen.getAllByRole('option')[1])                 // click BM

        expect(messages).toContainEqual({ type: 'SWITCH_LOCALE', locale: 'ms' })
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument() // closed

        window.parent.postMessage = orig
    })

    it('includes select-none and items-center on wrapper', () => {
        // TC-ID: F26-07-01-wrapper-classes
        const { container } = render(<NavLangSwitcherPlaceholder />)
        const wrapper = container.firstChild as HTMLElement
        expect(wrapper).toHaveClass('select-none')
        expect(wrapper).toHaveClass('items-center')
    })

    it('accepts custom className prop', () => {
        // TC-ID: F26-07-01-custom-className
        const { container } = render(<NavLangSwitcherPlaceholder className="hidden md:flex ml-2" />)
        const wrapper = container.firstChild as HTMLElement
        expect(wrapper).toHaveClass('hidden')
        expect(wrapper).toHaveClass('md:flex')
        expect(wrapper).toHaveClass('ml-2')
    })

    // TC-F26-07-02 — switcher renders exactly the configured [primary, secondary] pair.
    // Regression: a non-standard (e.g. Japanese) site used to hardcode [gen, EN, MS] = 3 flags,
    // contradicting the panel's max-2 model and letting visitors switch to an un-added language.
    it('non-standard site shows exactly 2 flags = [primary, secondary], not 3 (TC-F26-07-02)', () => {
        const store = useEditorStore.getState()
        store.setGenerationLocale('ja')
        store.setPrimaryLocale('ja')
        store.setSecondaryLocale('ms')
        store.setActiveLocale('ja')

        render(<NavLangSwitcherPlaceholder />)
        fireEvent.mouseEnter(screen.getByLabelText('Language switcher'))

        const options = screen.getAllByRole('option')
        expect(options).toHaveLength(2)                       // not 3 — EN is not offered
        expect(options.map(o => o.textContent).join(' ')).toContain('Japanese')
        expect(options.map(o => o.textContent).join(' ')).toContain('Malay')
        expect(options.map(o => o.textContent).join(' ')).not.toContain('English')
    })

    it('legacy non-standard site (no secondaryLocale) falls back to [primary, EN, MS]', () => {
        // Backward compat: sites that turned the switcher on before secondaryLocale was persisted.
        const store = useEditorStore.getState()
        store.setGenerationLocale('ja')
        store.setPrimaryLocale('ja')
        store.setSecondaryLocale(null)
        store.setActiveLocale('ja')

        render(<NavLangSwitcherPlaceholder />)
        fireEvent.mouseEnter(screen.getByLabelText('Language switcher'))

        expect(screen.getAllByRole('option')).toHaveLength(3) // ja + en + ms
    })
})
