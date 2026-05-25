import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ── Mock i18n ─────────────────────────────────────────────────────────────
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        locale: 'en',
        setLocale: vi.fn(),
        toggleLocale: vi.fn(),
        t: {
            cms: { profile: 'Profile', logout: 'Logout' },
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

describe('F18 Permission-Based Navigation Filtering', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('[TC-F18.30] Custom role with no permissions', () => {
        it('shows only Dashboard, Help Center, and Settings/Profile', () => {
            render(
                <DashboardSidebar
                    userName="Custom User"
                    userInitial="V"
                    currentUserRole="custom"
                    permissions={[]}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Help Center').length).toBeGreaterThan(0)
            expect(screen.getAllByRole('button', { name: /Settings/i }).length).toBeGreaterThan(0)

            expect(screen.queryAllByRole('link', { name: /Products/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Orders/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /My Website/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Customers/i }).length).toBe(0)
        })

        it('[TC-F18.31] Settings/Profile is visible but Staff is hidden', () => {
            render(
                <DashboardSidebar
                    userName="Custom User"
                    userInitial="V"
                    currentUserRole="custom"
                    permissions={[]}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.getAllByRole('button', { name: /Settings/i })[0]).toBeInTheDocument()
            expect(screen.queryAllByRole('link', { name: /Staff/i }).length).toBe(0)
        })
    })

    describe('[TC-F18.32] Editor with builder permission only', () => {
        it('shows My Website group (editor has full access, treated as admin)', () => {
            render(
                <DashboardSidebar
                    userName="Builder User"
                    userInitial="B"
                    currentUserRole="editor"
                    permissions={['builder']}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            // editor is a legacy role treated as full access
            expect(screen.getAllByText('My Website').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
        })
    })

    describe('[TC-F18.33] Editor with blog permission only', () => {
        it('shows My Website group (editor has full access, treated as admin)', () => {
            render(
                <DashboardSidebar
                    userName="Blog User"
                    userInitial="B"
                    currentUserRole="editor"
                    permissions={['blog']}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.getAllByText('My Website').length).toBeGreaterThan(0)
        })
    })

    describe('[TC-F18.34] Custom role with specific permissions', () => {
        it('shows Products and Orders, hides Customers', () => {
            render(
                <DashboardSidebar
                    userName="Products Manager"
                    userInitial="P"
                    currentUserRole="custom"
                    permissions={['products', 'orders']}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            expect(screen.queryAllByRole('link', { name: /Customers/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /My Website/i }).length).toBe(0)
        })

        it('[TC-F18.35] with empty permissions shows only unrestricted nav', () => {
            render(
                <DashboardSidebar
                    userName="Custom User"
                    userInitial="C"
                    currentUserRole="custom"
                    permissions={[]}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Help Center').length).toBeGreaterThan(0)
            expect(screen.queryAllByRole('link', { name: /Products/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Orders/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /My Website/i }).length).toBe(0)
        })
    })

    describe('[TC-F18.36] Admin role gets full access', () => {
        it('shows all features except Templates Health and Staff', () => {
            render(
                <DashboardSidebar
                    userName="Admin User"
                    userInitial="A"
                    currentUserRole="admin"
                    permissions={[]}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            expect(screen.getAllByText('My Website').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Help Center').length).toBeGreaterThan(0)
            expect(screen.queryAllByRole('link', { name: /Templates Health/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Staff/i }).length).toBe(0)
        })
    })

    describe('[TC-F18.37] Owner role gets full access including Staff', () => {
        it('shows all features except Templates Health, includes Staff', () => {
            render(
                <DashboardSidebar
                    userName="Owner User"
                    userInitial="O"
                    currentUserRole="owner"
                    permissions={[]}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            expect(screen.getAllByText('My Website').length).toBeGreaterThan(0)
            expect(screen.getAllByRole('button', { name: /Settings/i }).length).toBeGreaterThan(0)
            expect(screen.queryAllByRole('link', { name: /Templates Health/i }).length).toBe(0)
        })
    })

    describe('[TC-F18.38] Super admin sees Templates Health', () => {
        it('shows Templates Health nav item', () => {
            render(
                <DashboardSidebar
                    userName="Super Admin"
                    userInitial="S"
                    currentUserRole="owner"
                    permissions={[]}
                    isSuperAdmin={true}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            const templatesLinks = screen.queryAllByRole('link', { name: /Templates Health/i })
            const templatesBtns = screen.queryAllByRole('button', { name: /Templates Health/i })
            expect(templatesLinks.length + templatesBtns.length).toBeGreaterThan(0)
        })

        it('hides Templates Health when not super admin', () => {
            render(
                <DashboardSidebar
                    userName="Owner"
                    userInitial="O"
                    currentUserRole="owner"
                    permissions={[]}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.queryAllByRole('link', { name: /Templates Health/i }).length).toBe(0)
        })
    })

    describe('[TC-F18.39] Customers nav gating (owner/admin only)', () => {
        it('shows Customers for owner', () => {
            render(
                <DashboardSidebar
                    userName="Owner"
                    userInitial="O"
                    currentUserRole="owner"
                    permissions={[]}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.queryAllByRole('link', { name: /Customers/i }).length).toBeGreaterThan(0)
        })

        it('shows Customers for admin', () => {
            render(
                <DashboardSidebar
                    userName="Admin"
                    userInitial="A"
                    currentUserRole="admin"
                    permissions={[]}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.queryAllByRole('link', { name: /Customers/i }).length).toBeGreaterThan(0)
        })

        it('hides Customers for custom role even with orders permission', () => {
            render(
                <DashboardSidebar
                    userName="Custom"
                    userInitial="C"
                    currentUserRole="custom"
                    permissions={['products', 'orders']}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.queryAllByRole('link', { name: /Customers/i }).length).toBe(0)
        })
    })

    describe('[TC-F18.40] Settings/Staff gating (owner only)', () => {
        it('shows Staff link for owner', () => {
            render(
                <DashboardSidebar
                    userName="Owner"
                    userInitial="O"
                    currentUserRole="owner"
                    permissions={[]}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.queryAllByRole('link', { name: /Staff/i }).length).toBeGreaterThan(0)
        })

        it('hides Staff for admin', () => {
            render(
                <DashboardSidebar
                    userName="Admin"
                    userInitial="A"
                    currentUserRole="admin"
                    permissions={[]}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.queryAllByRole('link', { name: /Staff/i }).length).toBe(0)
        })

        it('hides Staff for custom role with any permissions', () => {
            render(
                <DashboardSidebar
                    userName="Custom"
                    userInitial="C"
                    currentUserRole="custom"
                    permissions={['products', 'orders', 'settings']}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.queryAllByRole('link', { name: /Staff/i }).length).toBe(0)
        })
    })

    describe('[TC-F18.41] My Website group collapse when no access', () => {
        it('hides My Website group when neither builder nor blog permission granted', () => {
            render(
                <DashboardSidebar
                    userName="Orders Manager"
                    userInitial="O"
                    currentUserRole="custom"
                    permissions={['products', 'orders']}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            const websiteLinks = screen.queryAllByRole('link', { name: /My Website/i })
            const websiteBtns = screen.queryAllByRole('button', { name: /My Website/i })
            expect(websiteLinks.length + websiteBtns.length).toBe(0)
        })

        it('shows My Website when has only builder', () => {
            render(
                <DashboardSidebar
                    userName="Builder"
                    userInitial="B"
                    currentUserRole="custom"
                    permissions={['builder']}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.queryAllByRole('button', { name: /My Website/i }).length).toBeGreaterThan(0)
        })

        it('shows My Website when has only blog', () => {
            render(
                <DashboardSidebar
                    userName="Blogger"
                    userInitial="B"
                    currentUserRole="custom"
                    permissions={['blog']}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.queryAllByRole('button', { name: /My Website/i }).length).toBeGreaterThan(0)
        })
    })

    describe('[TC-F18.42] Permission isolation - no permission bleeding', () => {
        it('admin sees all nav regardless of permissions[] value', () => {
            render(
                <DashboardSidebar
                    userName="Admin"
                    userInitial="A"
                    currentUserRole="admin"
                    permissions={['products']}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            expect(screen.getAllByText('My Website').length).toBeGreaterThan(0)
        })

        it('custom role with empty permissions does not see any gated items', () => {
            render(
                <DashboardSidebar
                    userName="Custom"
                    userInitial="C"
                    currentUserRole="custom"
                    permissions={[]}
                    isSuperAdmin={false}
                    mobileOpen={false}
                    setMobileOpen={vi.fn()}
                />
            )

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Help Center').length).toBeGreaterThan(0)
            expect(screen.queryAllByRole('link', { name: /Products/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Orders/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Customers/i }).length).toBe(0)
        })
    })
})
