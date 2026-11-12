/**
 * TC-PERF-125 — the dashboard sidebar prefetches a page when the merchant reaches for its link (hover, focus, touch),
 * never because the link is on screen: a page load no longer asks the server for every sidebar page (~30 RSC
 * requests per load measured before).
 * Real: DashboardSidebar, the nav config. Faked: next/link (renders its props: viewport prefetch is next/link's own
 * behaviour, switched off with `prefetch={false}`), next/navigation, i18n, theme.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ prefetch: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard', useRouter: () => router }))
vi.mock('next/link', () => ({
    default: ({ href, children, prefetch, ...props }: { href: string; children: React.ReactNode; prefetch?: boolean | null } & React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
        React.createElement('a', { href, 'data-viewport-prefetch': String(prefetch !== false), ...props }, children),
}))
vi.mock('@/i18n', () => ({
    useI18n: () => ({ locale: 'en', setLocale: vi.fn(), toggleLocale: vi.fn(), t: { cms: {}, dashboard: {} }, tp: vi.fn(), ti: vi.fn() }),
}))
vi.mock('@/providers/theme-provider', () => ({ useTheme: () => ({ theme: 'dark', toggle: vi.fn() }) }))

import { DashboardSidebar } from '@/components/dashboard/Sidebar'

const renderSidebar = () => render(
    <DashboardSidebar userName="A" userInitial="A" currentUserRole="owner" permissions={[]} isSuperAdmin={false} mobileOpen={false} setMobileOpen={vi.fn()} />,
)
const productsLink = () => screen.getAllByRole('link').find((a) => a.getAttribute('href') === '/products')!

afterEach(() => {
    cleanup()
    router.prefetch.mockClear()
})

describe('sidebar prefetch on intent [TC-PERF-125]', () => {
    it('TC-PERF-125 rendering the sidebar prefetches nothing; its links have no viewport prefetch', () => {
        // Act
        renderSidebar()

        // Assert
        expect(router.prefetch).not.toHaveBeenCalled()
        const navLinks = screen.getAllByRole('link').filter((a) => a.getAttribute('href') !== '/dashboard')
        expect(navLinks.length).toBeGreaterThan(5)
        for (const link of navLinks) expect(link).toHaveAttribute('data-viewport-prefetch', 'false')
    })

    it.each([
        ['hover', (el: HTMLElement) => fireEvent.mouseEnter(el)],
        ['keyboard focus', (el: HTMLElement) => fireEvent.focus(el)],
        ['touch', (el: HTMLElement) => fireEvent.touchStart(el)],
    ])('TC-PERF-125 %s on a link prefetches that page', (_how, reach) => {
        // Arrange
        renderSidebar()

        // Act
        reach(productsLink())

        // Assert
        expect(router.prefetch).toHaveBeenCalledWith('/products')
    })
})
