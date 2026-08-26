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

// NOTE (#1138 IA restructure): the sidebar is now FLAT — section headers are static text
// (not buttons), every item is a leaf link. RBAC intent per TC is unchanged unless noted:
// the one intentional change is TC-F18.40 — the old owner-only "Staff" link became
// "Team & Account" visible to ALL roles (the Staff tab is owner-gated inside the page).

function renderSidebar(props: Partial<React.ComponentProps<typeof DashboardSidebar>> = {}) {
    return render(
        <DashboardSidebar
            userName="Test User"
            userInitial="T"
            currentUserRole="custom"
            permissions={[]}
            isSuperAdmin={false}
            mobileOpen={false}
            setMobileOpen={vi.fn()}
            {...props}
        />
    )
}

describe('F18 Permission-Based Navigation Filtering', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('[TC-F18.30] Custom role with no permissions', () => {
        it('shows only Dashboard, Help Center, and Team & Account', () => {
            renderSidebar({ currentUserRole: 'custom', permissions: [] })

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Help Center').length).toBeGreaterThan(0)
            // Team & Account is visible to all roles (Profile tab is for everyone)
            expect(screen.getAllByRole('link', { name: /Team & Account/i }).length).toBeGreaterThan(0)

            expect(screen.queryAllByRole('link', { name: /Products/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Orders/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Editor/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Customers/i }).length).toBe(0)
        })

        it('[TC-F18.31] gated Settings items (Payments/Shipping/Domains/Email Templates) are hidden', () => {
            renderSidebar({ currentUserRole: 'custom', permissions: [] })

            expect(screen.queryAllByRole('link', { name: /Payments/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Shipping/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Domains/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Email Templates/i }).length).toBe(0)
        })
    })

    describe('[TC-F18.32] Editor with builder permission only', () => {
        it('shows Online Store section (editor is legacy full access)', () => {
            renderSidebar({ currentUserRole: 'editor', permissions: ['builder'] })

            // editor is a legacy role treated as full access
            expect(screen.getAllByText('Online Store').length).toBeGreaterThan(0)
            expect(screen.getAllByRole('link', { name: /Editor/i }).length).toBeGreaterThan(0)
            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
        })
    })

    describe('[TC-F18.33] Editor with blog permission only', () => {
        it('shows Online Store section (editor is legacy full access)', () => {
            renderSidebar({ currentUserRole: 'editor', permissions: ['blog'] })

            expect(screen.getAllByText('Online Store').length).toBeGreaterThan(0)
            expect(screen.getAllByRole('link', { name: /Blog/i }).length).toBeGreaterThan(0)
        })
    })

    describe('[TC-F18.34] Custom role with specific permissions', () => {
        it('shows Products and Orders, hides Customers and Online Store', () => {
            renderSidebar({ currentUserRole: 'custom', permissions: ['products', 'orders'] })

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            expect(screen.getAllByRole('link', { name: /Products/i }).length).toBeGreaterThan(0)
            expect(screen.getAllByRole('link', { name: /Orders/i }).length).toBeGreaterThan(0)
            expect(screen.queryAllByRole('link', { name: /Customers/i }).length).toBe(0)
            expect(screen.queryByText('Online Store')).toBeNull()
        })

        it('Discounts rides the orders permission (F33 nav parity)', () => {
            renderSidebar({ currentUserRole: 'custom', permissions: ['orders'] })
            expect(screen.getAllByRole('link', { name: /Discounts/i }).length).toBeGreaterThan(0)
        })

        it('Discounts hidden without the orders permission', () => {
            renderSidebar({ currentUserRole: 'custom', permissions: ['products'] })
            expect(screen.queryAllByRole('link', { name: /Discounts/i }).length).toBe(0)
        })

        it('[TC-F18.35] with empty permissions shows only unrestricted nav', () => {
            renderSidebar({ currentUserRole: 'custom', permissions: [] })

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Help Center').length).toBeGreaterThan(0)
            expect(screen.queryAllByRole('link', { name: /Products/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Orders/i }).length).toBe(0)
            expect(screen.queryByText('Online Store')).toBeNull()
        })
    })

    describe('[TC-F18.36] Admin role gets full access', () => {
        it('shows all sections', () => {
            renderSidebar({ currentUserRole: 'admin', permissions: [] })

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Online Store').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Core Operations').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Help Center').length).toBeGreaterThan(0)
        })
    })

    describe('[TC-F18.37] Owner role gets full access', () => {
        it('shows all sections', () => {
            renderSidebar({ currentUserRole: 'owner', permissions: [] })

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Online Store').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Settings').length).toBeGreaterThan(0)
        })
    })

    describe('[TC-F18.38] Templates Health removed from the sidebar nav (2026-06-11 — dev tool, direct-URL only)', () => {
        it('never renders for any role on dev', () => {
            renderSidebar({ currentUserRole: 'custom', permissions: [], isSuperAdmin: false, isProduction: false })

            expect(screen.queryAllByRole('link', { name: /Templates Health/i }).length).toBe(0)
        })

        it('never renders even for super admin', () => {
            renderSidebar({ currentUserRole: 'owner', permissions: [], isSuperAdmin: true, isProduction: false })

            expect(screen.queryAllByRole('link', { name: /Templates Health/i }).length).toBe(0)
        })
    })

    describe('[TC-F18.39] Customers nav gating (owner/admin only)', () => {
        it('shows All Customers for owner', () => {
            renderSidebar({ currentUserRole: 'owner', permissions: [] })

            expect(screen.getAllByRole('link', { name: /All Customers/i }).length).toBeGreaterThan(0)
            expect(screen.getAllByRole('link', { name: /Contact Leads/i }).length).toBeGreaterThan(0)
        })

        it('shows All Customers for admin', () => {
            renderSidebar({ currentUserRole: 'admin', permissions: [] })

            expect(screen.getAllByRole('link', { name: /All Customers/i }).length).toBeGreaterThan(0)
        })

        it('hides All Customers for custom role even with orders permission', () => {
            renderSidebar({ currentUserRole: 'custom', permissions: ['products', 'orders'] })

            expect(screen.queryAllByRole('link', { name: /Customers/i }).length).toBe(0)
            expect(screen.queryByText('CRM')).toBeNull()
        })
    })

    describe('[TC-F18.40] Team & Account visible to all roles (#1138 — replaces owner-only Staff link)', () => {
        // The owner-only gate moved INTO the page (Staff tab, phase-04); the sidebar item is
        // visible to everyone because the Profile tab serves all roles.
        it.each(['owner', 'admin', 'custom'])('shows Team & Account for %s', (role) => {
            renderSidebar({ currentUserRole: role, permissions: [] })

            expect(screen.getAllByRole('link', { name: /Team & Account/i }).length).toBeGreaterThan(0)
        })

        it('old Staff / Account profile items no longer exist as separate links', () => {
            renderSidebar({ currentUserRole: 'owner', permissions: [] })

            expect(screen.queryAllByRole('link', { name: /^Staff$/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Account profile/i }).length).toBe(0)
        })
    })

    describe('[TC-F18.41] Online Store section hides when no access', () => {
        it('hides Online Store (header + items) when neither builder nor blog granted', () => {
            renderSidebar({ currentUserRole: 'custom', permissions: ['products', 'orders'] })

            expect(screen.queryByText('Online Store')).toBeNull()
            expect(screen.queryAllByRole('link', { name: /Editor/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Blog/i }).length).toBe(0)
        })

        it('shows Online Store with only Editor when has only builder', () => {
            renderSidebar({ currentUserRole: 'custom', permissions: ['builder'] })

            expect(screen.getAllByText('Online Store').length).toBeGreaterThan(0)
            expect(screen.getAllByRole('link', { name: /Editor/i }).length).toBeGreaterThan(0)
            expect(screen.queryAllByRole('link', { name: /Blog/i }).length).toBe(0)
        })

        it('shows Online Store with only Blog when has only blog', () => {
            renderSidebar({ currentUserRole: 'custom', permissions: ['blog'] })

            expect(screen.getAllByText('Online Store').length).toBeGreaterThan(0)
            expect(screen.getAllByRole('link', { name: /Blog/i }).length).toBeGreaterThan(0)
            expect(screen.queryAllByRole('link', { name: /Editor/i }).length).toBe(0)
        })
    })

    describe('[TC-F18.42] Permission isolation - no permission bleeding', () => {
        it('admin sees all nav regardless of permissions[] value', () => {
            renderSidebar({ currentUserRole: 'admin', permissions: ['products'] })

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Online Store').length).toBeGreaterThan(0)
        })

        it('custom role with empty permissions does not see any gated items', () => {
            renderSidebar({ currentUserRole: 'custom', permissions: [] })

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Help Center').length).toBeGreaterThan(0)
            expect(screen.queryAllByRole('link', { name: /Products/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Orders/i }).length).toBe(0)
            expect(screen.queryAllByRole('link', { name: /Customers/i }).length).toBe(0)
        })
    })
})
