import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ── Mock i18n ─────────────────────────────────────────────────────────────
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        locale: 'en',
        setLocale: vi.fn(),
        toggleLocale: vi.fn(),
        t: {
            cms: {
                profile: 'Profile',
                logout: 'Logout',
                appSwitcher: { switchApp: 'Switch app', ssoRedirect: 'Secure SSO redirect' },
            },
            dashboard: { overview: { greeting: 'Good' } },
        },
        tp: vi.fn(),
        ti: vi.fn(),
    }),
    I18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ── Mock next/navigation ────────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/dashboard'),
    useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

// ── Mock next/link ─────────────────────────────────────────────────────────────
vi.mock('next/link', () => ({
    default: ({ href, children, className, onClick }: { href: string; children: React.ReactNode; className?: string; onClick?: () => void }) =>
        React.createElement('a', { href, className, onClick }, children),
}))

vi.mock('@/components/dashboard/NotificationBell', () => ({
    NotificationBell: () => <div data-testid="notification-bell">Bell</div>,
}))

vi.mock('@/app/(dashboard)/actions', () => ({
    logoutAction: vi.fn(() => Promise.resolve({ success: true })),
}))

vi.mock('@/providers/theme-provider', () => ({
    useTheme: () => ({ theme: 'dark', toggle: vi.fn() }),
    ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ── Imports ─────────────────────────────────────────────────────────────
import { DashboardSidebar } from '@/components/dashboard/Sidebar'
import { TopHeader } from '@/components/dashboard/TopHeader'
import { UserAvatarMenu } from '@/components/dashboard/UserAvatarMenu'
import { CMSLayoutClient } from '@/app/(dashboard)/_components/CMSLayoutClient'
import * as navigation from 'next/navigation'
import * as i18n from '@/i18n'

describe('F18 CMS Core Layout', () => {
    
    // Store original window.location
    const originalLocation = window.location
    
    beforeEach(() => {
        vi.clearAllMocks()
        // Mock global fetch
        global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
        
        // Mock window.location
        delete (window as any).location
        window.location = { ...originalLocation, href: '' } as any
    })
    
    afterEach(() => {
        window.location = originalLocation
    })

    describe('Sidebar Navigation (TC-F18.01, TC-F18.21, TC-F18.10, TC-F18.22, TC-F18.05)', () => {
        const defaultProps = {
            userName: 'Test User',
            userInitial: 'T',
            mobileOpen: false,
            setMobileOpen: vi.fn(),
            currentUserRole: 'owner',
            permissions: ['builder', 'blog', 'products', 'orders', 'settings'],
        }

        it('[TC-F18.01] Renders Desktop sidebar with flat section headers and links (#1138 IA)', () => {
            render(<DashboardSidebar {...defaultProps} />)
            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            // Flat IA: static section headers replace the old accordion groups
            expect(screen.getAllByText('Online Store').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Core Operations').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Settings').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Support').length).toBeGreaterThan(0)

            // Check hrefs
            const dashboardLinks = screen.getAllByRole('link', { name: /Dashboard/i })
            expect(dashboardLinks[0]).toHaveAttribute('href', '/dashboard')
        })

        it('[TC-F18.21] Flat IA: Editor and Blog always visible, no accordion to expand (#1138)', () => {
            render(<DashboardSidebar {...defaultProps} />)

            // Section header is a static label — must NOT be a button (no expand/collapse)
            expect(screen.queryByRole('button', { name: /Online Store/i })).toBeNull()
            expect(screen.queryByRole('button', { name: /My Website/i })).toBeNull()

            // Leaves render immediately without any click
            expect(screen.getAllByRole('link', { name: /Editor/i })[0]).toHaveAttribute('href', '/editor')
            expect(screen.getAllByRole('link', { name: /Blog/i })[0]).toHaveAttribute('href', '/blog')
        })

        it('[TC-F18.01b] Badge pill renders from badgeCounts prop, hidden when 0/undefined (#1138)', () => {
            const { rerender } = render(
                <DashboardSidebar {...defaultProps} badgeCounts={{ orders: 384, products: 0 }} />
            )
            // orders=384 → pill visible; products=0 and discounts=undefined → no pill
            expect(screen.getAllByText('384').length).toBeGreaterThan(0)
            expect(screen.queryByText('0')).toBeNull()

            // No badgeCounts at all → no pills anywhere (UI-only, no fake data)
            rerender(<DashboardSidebar {...defaultProps} />)
            expect(screen.queryByText('384')).toBeNull()

            // Large counts use compact international notation (1500 → "1.5K") so the pill never overflows
            rerender(<DashboardSidebar {...defaultProps} badgeCounts={{ orders: 1500 }} />)
            expect(screen.getAllByText('1.5K').length).toBeGreaterThan(0)
            expect(screen.queryByText('1500')).toBeNull()
        })

        it('[TC-F18.01c] Relabels: Email Templates keeps the email-templates route; Team & Account points to staff (#1138)', () => {
            render(<DashboardSidebar {...defaultProps} />)
            expect(screen.getAllByRole('link', { name: /Email Templates/i })[0]).toHaveAttribute('href', '/settings/email-templates')
            expect(screen.getAllByRole('link', { name: /Team & Account/i })[0]).toHaveAttribute('href', '/settings/staff')
            expect(screen.getAllByRole('link', { name: /All Customers/i })[0]).toHaveAttribute('href', '/customers')
            expect(screen.getAllByRole('link', { name: /Discounts/i })[0]).toHaveAttribute('href', '/discounts')
            // Media stays out of the nav (old-version parity decision)
            expect(screen.queryByRole('link', { name: /Media/i })).toBeNull()
        })

        it('[TC-F18.10] Toggles Language (MY/EN)', () => {
            const toggleLocaleMock = vi.fn()
            vi.spyOn(i18n, 'useI18n').mockReturnValue({ 
                locale: 'en', 
                setLocale: vi.fn(), 
                toggleLocale: toggleLocaleMock, 
                t: { cms: { profile: 'Profile', logout: 'Logout', appSwitcher: { switchApp: 'Switch app', ssoRedirect: 'Secure SSO redirect' } }, dashboard: { overview: { greeting: 'Good' } } } as any,
                tp: vi.fn(),
                ti: vi.fn()
            })
            
            render(<DashboardSidebar {...defaultProps} />)
            
            const myBtns = screen.getAllByText('MY')
            fireEvent.click(myBtns[0]) 
            expect(toggleLocaleMock).toHaveBeenCalled()
        })
        
        it('[TC-F18.05] Renders Help Center link', () => {
            render(<DashboardSidebar {...defaultProps} />)
            
            const helpLinks = screen.getAllByRole('link', { name: /Help Center/i })
            expect(helpLinks[0]).toHaveAttribute('href', '/help')
        })

        it('[TC-F18.24] Closes mobile drawer when a link is clicked or route changes', () => {
            const setMobileOpen = vi.fn()
            const { rerender } = render(<DashboardSidebar {...defaultProps} mobileOpen={true} setMobileOpen={setMobileOpen} />)
            
            // Fake route change by changing pathname 
            vi.spyOn(navigation, 'usePathname').mockReturnValue('/products')
            rerender(<DashboardSidebar {...defaultProps} mobileOpen={true} setMobileOpen={setMobileOpen} />)
            
            expect(setMobileOpen).toHaveBeenCalledWith(false)
        })
    })

    describe('Top Header & User Avatar (TC-F18.07, TC-F18.08, TC-F18.09, TC-F18.18, TC-F18.03)', () => {

        const defaultProps = {
            userName: 'John Doe',
            userInitial: 'J',
            sidebarOpen: false,
            setSidebarOpen: vi.fn(),
        }

        it('[TC-F18.07] Logo routes to /dashboard', () => {
            render(<TopHeader {...defaultProps} />)
            
            const logoLink = screen.getByRole('link', { name: /PrimeWeb Logo/i })
            expect(logoLink).toHaveAttribute('href', '/dashboard')
        })

        it('[TC-F18.03] Mobile Menu (Hamburger) triggers setSidebarOpen', () => {
            render(<TopHeader {...defaultProps} sidebarOpen={false} />)
            
            const menuBtn = screen.getByLabelText('Open menu')
            fireEvent.click(menuBtn)
            expect(defaultProps.setSidebarOpen).toHaveBeenCalledWith(true)
        })

        it('[TC-F18.08] Renders Notification Bell', () => {
            render(<TopHeader {...defaultProps} />)
            expect(screen.getByTestId('notification-bell')).toBeInTheDocument()
        })

        it('[TC-F18.43] App Switcher ⊞ opens dropdown with SSO redirect, closes on ESC (#1138 P03)', () => {
            render(<TopHeader {...defaultProps} />)

            const btn = screen.getByLabelText('Switch app')
            expect(btn).toHaveAttribute('aria-expanded', 'false')

            // Open → current app (Web Store) is NOT listed; Secure SSO redirect link shown
            fireEvent.click(btn)
            expect(btn).toHaveAttribute('aria-expanded', 'true')
            expect(screen.queryByText('Web Store')).toBeNull()
            const sso = screen.getByText('Secure SSO redirect')
            expect(sso.closest('a')).toHaveAttribute('target', '_blank')

            // ESC closes
            fireEvent.keyDown(document, { key: 'Escape' })
            expect(screen.queryByText('Secure SSO redirect')).toBeNull()
        })

        it('[TC-F18.09] Avatar drops down showing Profile and Logout', () => {
            render(<UserAvatarMenu userName="John Doe" userInitial="J" />)
            
            const trigger = screen.getByRole('button', { expanded: false })
            fireEvent.click(trigger)
            
            expect(screen.getByText('John Doe')).toBeInTheDocument()
            expect(screen.getByText('johndoe@primeweb.my')).toBeInTheDocument()
            expect(screen.getByText('Profile')).toBeInTheDocument()
            expect(screen.getByText('Logout')).toBeInTheDocument()
        })

        it('[TC-F18.09] Handles Logout accurately', async () => {
            render(<UserAvatarMenu userName="John Doe" userInitial="J" />)
            
            // Open menu
            fireEvent.click(screen.getByRole('button', { expanded: false }))
            
            // Click Logout
            fireEvent.click(screen.getByText('Logout'))
            
            expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', expect.any(Object))
            
            await waitFor(() => {
                expect(window.location.href).toBe('/login')
            })
        })

        it('[TC-F18.18] Prevents XSS rendering as raw HTML in Avatar Name', () => {
            const maliciousName = "<script>alert('idor')</script>"
            render(<UserAvatarMenu userName={maliciousName} userInitial="X" />)
            
            // Open menu
            fireEvent.click(screen.getByRole('button', { expanded: false }))
            
            expect(screen.queryByText(maliciousName)).toBeInTheDocument()
            
            // Should not inject actual DOM script tags from string variables in React
            expect(document.querySelector('script')).not.toBeInTheDocument()
        })
    })

    describe('CMS Layout Integration', () => {
        it('Renders the integrated Shell components', () => {
            render(
                <CMSLayoutClient userName="Test User" userInitial="T">
                    <div data-testid="page-content">Main Content</div>
                </CMSLayoutClient>
            )
            
            expect(screen.getByTestId('page-content')).toBeInTheDocument()
            expect(screen.getByRole('banner')).toBeInTheDocument() // `<header>`
            expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0) // `<nav>`
        })
    })
})
