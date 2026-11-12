/**
 * TC-F15.42 (banner render), TC-F15.43 (Exit), TC-F15.44 (sidebar item), TC-F15.45 (recent table).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

const { clearClientAiState } = vi.hoisted(() => ({ clearClientAiState: vi.fn() }))
vi.mock('@/lib/auth/clear-client-ai-state', () => ({ clearClientAiState }))
vi.mock('next/navigation', () => ({ usePathname: () => '/studio', useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/app/studio/_components/theme-density-accent-switcher', () => ({
    useStudioPreferences: () => ({ sidebarCollapsed: false, setSidebarCollapsed: vi.fn() }),
}))

import { I18nProvider } from '@/i18n'
import { MerchantAccessBanner } from '@/components/auth/merchant-access-banner'
import { AdminSidebar } from '@/app/studio/_components/admin-sidebar'
import { MerchantAccessClient } from '@/components/support/merchant-access-client'
import { RecentMerchantAccess } from '@/app/studio/merchant-access/_components/recent-merchant-access'

const counts = { issues: 0 } as never
const inTwoHours = () => new Date(Date.now() + 2 * 3_600_000 + 5 * 60_000).toISOString()
const renderBanner = (expiresAt: string) =>
    render(
        <I18nProvider defaultLocale="en">
            <MerchantAccessBanner merchantEmail="owner@shop.test" actorEmail="ben@primecommerce.asia" expiresAt={expiresAt} />
        </I18nProvider>,
    )

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('[TC-F15.42] MerchantAccessBanner', () => {
    it('TC-F15.42: shows merchant, actor, time left and an Exit button', () => {
        renderBanner(inTwoHours())
        const bar = screen.getByRole('status')
        expect(bar.textContent).toContain('Viewing as owner@shop.test (by ben@primecommerce.asia)')
        expect(bar.textContent).toMatch(/2h \d+m left/)
        expect(screen.getByRole('button', { name: 'Exit' })).toBeTruthy()
    })

    it('TC-F15.42: server render has no time left, so hydration cannot mismatch on the minute', async () => {
        const { renderToString } = await import('react-dom/server')
        const html = renderToString(
            <I18nProvider defaultLocale="en">
                <MerchantAccessBanner merchantEmail="owner@shop.test" actorEmail="ben@primecommerce.asia" expiresAt={inTwoHours()} />
            </I18nProvider>,
        )
        expect(html).toContain('Viewing as owner@shop.test (by ben@primecommerce.asia)')
        expect(html).not.toMatch(/\dh \d+m left/)
    })

    it('TC-F15.42: shows "Session expired" once the token has expired', () => {
        renderBanner(new Date(Date.now() - 1000).toISOString())
        expect(screen.getByRole('status').textContent).toContain('Session expired')
    })
})

describe('[TC-F15.43] Exit ends the impersonated session', () => {
    it('TC-F15.43: Exit posts logout, clears client AI state, then goes to /login', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true })
        vi.stubGlobal('fetch', fetchMock)
        const location = { href: '' }
        vi.stubGlobal('location', location)
        renderBanner(inTwoHours())

        fireEvent.click(screen.getByRole('button', { name: 'Exit' }))

        await waitFor(() => expect(location.href).toBe('/login'))
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }))
        expect(clearClientAiState).toHaveBeenCalledTimes(1)
        vi.unstubAllGlobals()
    })

    it('TC-F15.43: a failed logout keeps the page and shows an error instead of leaving', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
        const location = { href: '' }
        vi.stubGlobal('location', location)
        renderBanner(inTwoHours())

        fireEvent.click(screen.getByRole('button', { name: 'Exit' }))

        await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
        expect(location.href).toBe('')
        expect(clearClientAiState).not.toHaveBeenCalled()
        vi.unstubAllGlobals()
    })
})

describe('[TC-F15.44] Studio sidebar', () => {
    const user = { id: '1', email: 'a@p.test', name: 'Ben Lee', roles: ['super-admin'], readOnly: false }

    it('TC-F15.44: super-admin sees Merchant CMS access linking to the Studio page', () => {
        render(<AdminSidebar user={user} counts={counts} />)
        const link = screen.getByRole('link', { name: /Merchant CMS access/ })
        expect(link.getAttribute('href')).toBe('/studio/merchant-access')
    })

    it.each(['studio-content', 'studio-reviewer', 'studio-qa', 'studio-ops'])('TC-F15.44: %s without support does not see merchant access', (role) => {
        // Arrange / Act
        render(<AdminSidebar user={{ ...user, roles: [role], readOnly: false }} counts={counts} />)
        // Assert
        expect(screen.queryByRole('link', { name: /Merchant CMS access/ })).toBeNull()
    })

    it('TC-F15.44: a QA with support keeps the independent support link, without AI settings', () => {
        // Arrange / Act
        render(<AdminSidebar user={{ ...user, roles: ['studio-qa', 'support'], readOnly: false }} counts={counts} />)
        // Assert
        expect(screen.getByRole('link', { name: /Merchant CMS access/ }).getAttribute('href')).toBe('/support/merchant-access')
        expect(screen.queryByRole('link', { name: /^Settings$/ })).toBeNull()
    })

    it('TC-F15.44: a read-only viewer does not see it', () => {
        render(<AdminSidebar user={{ ...user, roles: ['studio-viewer'], readOnly: true }} counts={counts} />)
        expect(screen.queryByRole('link', { name: /Merchant CMS access/ })).toBeNull()
    })
})

describe('[TC-F15.45] RecentMerchantAccess table', () => {
    const base = { actorEmail: 'ben@p.test', targetEmail: 'm@s.test' }
    const now = new Date('2026-11-10T12:00:00Z')

    it('TC-F15.45: renders creator, merchant and the three statuses', () => {
        render(
            <RecentMerchantAccess
                now={now}
                events={[
                    { ...base, id: 1, createdAt: '2026-11-10T11:00:00Z', expiresAt: '2026-11-10T11:10:00Z', usedAt: '2026-11-10T11:02:00Z' },
                    { ...base, id: 2, createdAt: '2026-11-10T10:00:00Z', expiresAt: '2026-11-10T10:10:00Z', usedAt: null },
                    { ...base, id: 3, createdAt: '2026-11-10T11:58:00Z', expiresAt: '2026-11-10T12:08:00Z', usedAt: null },
                ]}
            />,
        )
        expect(screen.getAllByText('ben@p.test')).toHaveLength(3)
        expect(screen.getByText('Opened at 2026-11-10 11:02 UTC')).toBeTruthy()
        expect(screen.getByText('Expired')).toBeTruthy()
        expect(screen.getByText('Unused')).toBeTruthy()
    })

    it('TC-F15.45: shows an empty state and a load failure message', () => {
        const { rerender } = render(<RecentMerchantAccess events={[]} />)
        expect(screen.getByText('No links created yet.')).toBeTruthy()
        rerender(<RecentMerchantAccess events={[]} failed />)
        expect(screen.getByRole('alert')).toBeTruthy()
    })
})

describe('[TC-F15.45] MerchantAccessClient auto-copy', () => {
    async function createLinkWithClipboard(writeText: () => Promise<void>) {
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 5, email: 'owner@shop.test', name: 'O', tenants: [{ id: 1, name: 'Shop', status: 'active' }] }] }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { url: 'https://x.test/sso/merchant-access?token=t', expiresAt: new Date().toISOString() } }) }))
        render(<MerchantAccessClient />)
        fireEvent.change(screen.getByLabelText('Merchant email or company name'), { target: { value: 'owner' } })
        fireEvent.click(screen.getByRole('button', { name: 'Search' }))
        expect(await screen.findByText('Shop (active)')).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: 'Create login link' }))
        await screen.findByLabelText('Login link')
    }

    it('TC-F15.45: copies the link automatically and tells the admin to use a private window', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        await createLinkWithClipboard(writeText)
        expect(writeText).toHaveBeenCalledWith('https://x.test/sso/merchant-access?token=t')
        expect(screen.getByText(/Link copied/)).toBeTruthy()
        expect(screen.getByText(/private window/)).toBeTruthy()
        vi.unstubAllGlobals()
    })

    it('TC-F15.45: falls back to the Copy button when the clipboard is denied', async () => {
        await createLinkWithClipboard(vi.fn().mockRejectedValue(new Error('denied')))
        expect(screen.queryByText(/Link copied/)).toBeNull()
        expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy()
        vi.unstubAllGlobals()
    })
})
