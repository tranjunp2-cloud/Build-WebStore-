import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NavigationBlock } from '@/blocks/navigation'
import { I18nProvider } from '@/i18n'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
}))

vi.mock('framer-motion', () => {
    const React = require('react')

    const createPrimitive = (tag: keyof JSX.IntrinsicElements) => {
        const Component = React.forwardRef(({ children, ...props }: React.HTMLAttributes<HTMLElement>, ref: React.Ref<HTMLElement>) =>
            React.createElement(tag, { ...props, ref }, children))
        Component.displayName = `Motion${tag}`
        return Component
    }

    return {
        motion: {
            create: (Component) => React.forwardRef(({ children, ...rest }, ref) => React.createElement(Component, { ...rest, ref }, children)),
            nav: createPrimitive('nav'),
            div: createPrimitive('div'),
            a: createPrimitive('a'),
            button: createPrimitive('button'),
        },
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }
})

describe('NavigationBlock nested links', () => {
    const site = { theme: {} }

    it('renders nested children inside the sidebar variant', () => {
        render(
            <I18nProvider defaultLocale="en">
                <NavigationBlock
                    block={{
                        blockType: 'navigation',
                        variant: 'sidebar',
                        logoText: 'Brand',
                        links: [
                            {
                                label: 'Services',
                                url: '/services',
                                children: [
                                    { label: 'Consulting', url: '/services/consulting' },
                                    { label: 'Training', url: '/services/training' },
                                ],
                            },
                        ],
                    }}
                    theme={{}}
                    site={site}
                    page={{}}
                />
            </I18nProvider>
        )

        fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))

        expect(screen.getByText('Services')).toBeInTheDocument()
        expect(screen.getByText('Consulting')).toBeInTheDocument()
        expect(screen.getByText('Training')).toBeInTheDocument()
    })

    it('renders actual child links in mega-menu panels', () => {
        render(
            <I18nProvider defaultLocale="en">
                <NavigationBlock
                    block={{
                        blockType: 'navigation',
                        variant: 'mega-menu',
                        logoText: 'Brand',
                        links: [
                            {
                                label: 'Services',
                                url: '/services',
                                children: [
                                    { label: 'Consulting', url: '/services/consulting' },
                                    { label: 'Training', url: '/services/training' },
                                ],
                            },
                            {
                                label: 'About',
                                url: '/about',
                            },
                        ],
                    }}
                    theme={{}}
                    site={site}
                    page={{}}
                />
            </I18nProvider>
        )

        fireEvent.mouseEnter(screen.getByRole('button', { name: /Services/i }))

        expect(screen.getByText('Consulting')).toBeInTheDocument()
        expect(screen.getByText('Training')).toBeInTheDocument()
        expect(screen.queryByText('Overview')).not.toBeInTheDocument()
    })
})
