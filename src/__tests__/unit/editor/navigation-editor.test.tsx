import React, { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import { NavigationEditor, type NavLinkItem } from '@/components/editor/NavigationEditor'
import { toast } from 'sonner'

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
    },
}))

function NavigationEditorHarness() {
    const [links, setLinks] = useState<NavLinkItem[]>([
        {
            id: 'nav-1',
            label: 'Home',
            url: '/',
            type: 'page',
            children: [],
        },
    ])

    return (
        <I18nProvider defaultLocale="en">
            <NavigationEditor
                links={links}
                onUpdate={setLinks}
                pages={[
                    { id: 'page-1', title: 'Home', slug: '' },
                    { id: 'page-2', title: 'About', slug: 'about' },
                ]}
            />
        </I18nProvider>
    )
}

describe('NavigationEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps the edit panel open while interacting with controls inside it', () => {
        render(<NavigationEditorHarness />)

        fireEvent.click(screen.getByRole('button', { name: '✏️' }))

        expect(screen.getAllByRole('combobox')).toHaveLength(2)

        fireEvent.change(screen.getAllByRole('combobox')[0], {
            target: { value: 'external' },
        })

        expect(screen.getAllByRole('combobox')).toHaveLength(1)
        expect(screen.getByPlaceholderText('https://...')).toBeInTheDocument()

        fireEvent.blur(screen.getByPlaceholderText('https://...'), {
            target: { value: 'https://example.com' },
        })

        expect(screen.getAllByRole('combobox')).toHaveLength(1)
        expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument()
    })

    it('does not prepend an extra slash for page slugs that already include one', () => {
        render(
            <I18nProvider defaultLocale="en">
                <NavigationEditor
                    links={[
                        {
                            id: 'nav-1',
                            label: 'About',
                            url: '/about',
                            type: 'page',
                            children: [],
                        },
                    ]}
                    onUpdate={() => {}}
                    pages={[
                        { id: 'page-1', title: 'About', slug: '/about' },
                    ]}
                />
            </I18nProvider>
        )

        fireEvent.click(screen.getByRole('button', { name: '✏️' }))

        const selects = screen.getAllByRole('combobox')
        expect(selects[1]).toHaveValue('/about')
        expect(screen.queryByDisplayValue('//about')).not.toBeInTheDocument()
    })

    it('shows a toast and keeps previous external URL when blurred empty', () => {
        const onUpdate = vi.fn()

        render(
            <I18nProvider defaultLocale="en">
                <NavigationEditor
                    links={[
                        {
                            id: 'nav-1',
                            label: 'Docs',
                            url: 'https://example.com',
                            type: 'external',
                            children: [],
                        },
                    ]}
                    onUpdate={onUpdate}
                    pages={[]}
                />
            </I18nProvider>
        )

        fireEvent.click(screen.getByRole('button', { name: '✏️' }))
        fireEvent.blur(screen.getByDisplayValue('https://example.com'), {
            target: { value: '   ' },
        })

        expect(toast.error).toHaveBeenCalledWith('Link URL is required')
        expect(onUpdate).not.toHaveBeenCalled()
    })

    it('shows a toast and keeps previous external URL when format is invalid', () => {
        const onUpdate = vi.fn()

        render(
            <I18nProvider defaultLocale="en">
                <NavigationEditor
                    links={[
                        {
                            id: 'nav-1',
                            label: 'Docs',
                            url: 'https://example.com',
                            type: 'external',
                            children: [],
                        },
                    ]}
                    onUpdate={onUpdate}
                    pages={[]}
                />
            </I18nProvider>
        )

        fireEvent.click(screen.getByRole('button', { name: '✏️' }))
        fireEvent.blur(screen.getByDisplayValue('https://example.com'), {
            target: { value: 'https://asdasd' },
        })

        expect(toast.error).toHaveBeenCalledWith('Please enter a valid URL starting with http:// or https://')
        expect(onUpdate).not.toHaveBeenCalled()
    })
})
