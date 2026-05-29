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

        // Trigger button shows flag only (EN by default)
        const trigger = screen.getByRole('button')
        expect(trigger).toBeInTheDocument()
        expect(trigger.textContent).toContain('🇬🇧')

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
        expect(options[0].textContent).toContain('🇬🇧')
        expect(options[1].textContent).toContain('🇲🇾')
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
})
