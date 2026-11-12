import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NavOrderSearch } from '@/blocks/navigation/NavOrderSearch'
import { NavMobileMenuDrawer, NavigationBlock } from '@/blocks/navigation'
import { I18nProvider } from '@/i18n'

const push = vi.fn()
let mockPathname = '/'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push }),
    usePathname: () => mockPathname,
}))

vi.mock('framer-motion', () => {
    const React = require('react')
    const prim = (tag: string) => {
        const C = React.forwardRef(({ children, ...p }: Record<string, unknown>, ref: unknown) =>
            React.createElement(tag, { ...p, ref }, children))
        C.displayName = `Motion${tag}`
        return C
    }
    const AnimatePresence = ({ children }: { children: React.ReactNode }) => <>{children}</>
    AnimatePresence.displayName = 'AnimatePresenceMock'
    return {
        motion: {
            create: (C: React.ElementType) => {
                const M = React.forwardRef(({ children, ...r }: Record<string, unknown>, ref: unknown) =>
                    React.createElement(C, { ...r, ref }, children))
                M.displayName = 'MotionCreateMock'
                return M
            },
            nav: prim('nav'), div: prim('div'), a: prim('a'), button: prim('button'),
        },
        AnimatePresence,
    }
})

/**
 * TC-F09.295..298 — Track order entry inside the mobile nav drawer (GH-2275, QC D5-02).
 */
const renderInline = (ui: React.ReactElement) => render(<I18nProvider>{ui}</I18nProvider>)

beforeEach(() => {
    push.mockClear()
    mockPathname = '/'
})

describe('NavOrderSearch inline (mobile drawer)', () => {
    it('renders the Track order form inline without a toggle', () => {
        // TC-F09.295
        renderInline(<NavOrderSearch slug="foo" variant="inline" />)
        expect(screen.getByTestId('nav-order-search-inline')).toBeInTheDocument()
        expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('navigates to /orders/<encoded code> and calls onNavigate', () => {
        // TC-F09.296
        const onNavigate = vi.fn()
        renderInline(<NavOrderSearch slug="foo" variant="inline" onNavigate={onNavigate} />)
        fireEvent.change(screen.getByRole('textbox'), { target: { value: ' ORD 1/2 ' } })
        fireEvent.submit(screen.getByTestId('nav-order-search-inline'))
        expect(push).toHaveBeenCalledWith('/orders/ORD%201%2F2')
        expect(onNavigate).toHaveBeenCalledTimes(1)
    })

    it('prefixes /sites/<slug> on preview paths', () => {
        // TC-F09.296
        mockPathname = '/sites/foo/products'
        renderInline(<NavOrderSearch slug="foo" variant="inline" />)
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ORD-1' } })
        fireEvent.submit(screen.getByTestId('nav-order-search-inline'))
        expect(push).toHaveBeenCalledWith('/sites/foo/orders/ORD-1')
    })

    it('shows required error and does not navigate on empty code', () => {
        // TC-F09.297
        const onNavigate = vi.fn()
        renderInline(<NavOrderSearch slug="foo" variant="inline" onNavigate={onNavigate} />)
        fireEvent.submit(screen.getByTestId('nav-order-search-inline'))
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(push).not.toHaveBeenCalled()
        expect(onNavigate).not.toHaveBeenCalled()
    })
})

describe('Mobile nav surfaces expose Track order only with a tenant slug', () => {
    const drawer = (orderSearchSlug?: string) =>
        renderInline(
            <NavMobileMenuDrawer open onClose={() => {}} links={[]} orderSearchSlug={orderSearchSlug} />,
        )

    it('drawer renders the form when orderSearchSlug is set', () => {
        // TC-F09.295
        drawer('foo')
        expect(screen.getByTestId('nav-order-search-inline')).toBeInTheDocument()
    })

    it('drawer hides the form when orderSearchSlug is missing', () => {
        // TC-F09.295
        drawer(undefined)
        expect(screen.queryByTestId('nav-order-search-inline')).not.toBeInTheDocument()
    })

    const renderNav = (variant: string, hasCart: boolean) =>
        renderInline(
            <NavigationBlock
                block={{ blockType: 'navigation', variant, logoText: 'B', links: [], _hasCart: hasCart } as never}
                theme={{}}
                site={{ theme: {}, tenantSlug: 'foo' } as never}
                page={{} as never}
            />,
        )

    const VARIANTS = ['default', 'transparent', 'centered', 'mega', 'floating']

    it.each(VARIANTS)('variant %s shows the form after opening the menu when the store has a cart widget', (variant) => {
        // TC-F09.298 (floating dropdown is separate from NavMobileMenuDrawer)
        renderNav(variant, true)
        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
        expect(screen.getByTestId('nav-order-search-inline')).toBeInTheDocument()
    })

    it.each(VARIANTS)('variant %s hides the form without a cart widget', (variant) => {
        // TC-F09.298
        renderNav(variant, false)
        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
        expect(screen.queryByTestId('nav-order-search-inline')).not.toBeInTheDocument()
    })

    it.each(VARIANTS)('variant %s navigates and closes the menu on submit', (variant) => {
        // TC-F09.296
        renderNav(variant, true)
        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ORD-9' } })
        fireEvent.submit(screen.getByTestId('nav-order-search-inline'))
        expect(push).toHaveBeenCalledWith('/orders/ORD-9')
        expect(screen.queryByTestId('nav-order-search-inline')).not.toBeInTheDocument()
    })
})

describe('Long mobile menus stay scrollable so Track order is reachable', () => {
    const manyLinks = Array.from({ length: 20 }, (_, i) => ({ label: `Link ${i}`, url: `/l${i}` }))
    const panelOf = () => screen.getByTestId('nav-order-search-inline').closest('.md\\:hidden') as HTMLElement

    it('shared drawer caps height to the viewport and scrolls', () => {
        // TC-F09.298 (jsdom has no layout: asserts the scroll classes, real scroll is manual)
        renderInline(<NavMobileMenuDrawer open onClose={() => {}} links={manyLinks} orderSearchSlug="foo" />)
        expect(panelOf().className).toContain('overflow-y-auto')
        expect(panelOf().className).toContain('max-h-[calc(100dvh-')
    })

    it('floating dropdown caps height to the viewport and scrolls', () => {
        // TC-F09.298
        renderInline(
            <NavigationBlock
                block={{ blockType: 'navigation', variant: 'floating', logoText: 'B', links: manyLinks, _hasCart: true } as never}
                theme={{}}
                site={{ theme: {}, tenantSlug: 'foo' } as never}
                page={{} as never}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
        expect(panelOf().className).toContain('overflow-y-auto')
        expect(panelOf().className).toContain('max-h-[calc(100dvh-')
    })
})
