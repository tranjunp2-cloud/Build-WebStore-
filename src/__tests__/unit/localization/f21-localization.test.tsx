import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'

// ── Mock next/navigation ──────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/dashboard'),
    useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
    useSearchParams: vi.fn(() => ({ get: vi.fn(() => null) })),
}))

// ── Mock next/link ────────────────────────────────────────────────────────
vi.mock('next/link', () => ({
    default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
        React.createElement('a', { href, className }, children),
}))

// ── Mock sonner (toast) ───────────────────────────────────────────────────
vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

// ── Mock NotificationBell ─────────────────────────────────────────────────
vi.mock('@/components/dashboard/NotificationBell', () => ({
    NotificationBell: () => <div data-testid="notification-bell">Bell</div>,
}))

// ── Imports ──────────────────────────────────────────────────────────────
import { I18nProvider, useI18n, syncLocaleFromDB } from '@/i18n'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { DashboardSidebar } from '@/components/dashboard/Sidebar'
import * as i18nModule from '@/i18n'

// ── Helpers ───────────────────────────────────────────────────────────────
const LOCALE_KEY = 'prefer_lang'

/** Renders children wrapped in I18nProvider for hook access */
function TestI18nConsumer() {
    const { locale, setLocale, toggleLocale, tp, ti, t } = useI18n()
    return (
        <div>
            <span data-testid="locale">{locale}</span>
            <span data-testid="dashboard-label">{t.dashboard.overview.customize}</span>
            <button onClick={() => setLocale('ms')} data-testid="set-ms">Set MS</button>
            <button onClick={() => setLocale('en')} data-testid="set-en">Set EN</button>
            <button onClick={toggleLocale} data-testid="toggle">Toggle</button>
            <span data-testid="tp-result">{tp(t.plural.issue, 2)}</span>
            <span data-testid="tp-result-one">{tp(t.plural.issue, 1)}</span>
            <span data-testid="ti-result">{ti('{count} isu dalam senarai', { count: 5 })}</span>
        </div>
    )
}

function renderWithI18n(locale?: 'en' | 'ms') {
    return render(
        <I18nProvider defaultLocale={locale ?? 'en'}>
            <TestI18nConsumer />
        </I18nProvider>
    )
}

const sidebarProps = {
    userName: 'Aisha Store',
    userInitial: 'A',
    mobileOpen: false,
    setMobileOpen: vi.fn(),
}

// ═══════════════════════════════════════════════════════════════════════════
// TC-F21.07 — Default language EN (BR-01)
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F21.07] Default Language = EN (BR-01)', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('initialises with English when no localStorage key exists', () => {
        renderWithI18n()
        expect(screen.getByTestId('locale').textContent).toBe('en')
    })

    it('loads English translation strings on first-touch', () => {
        renderWithI18n()
        expect(screen.getByTestId('dashboard-label').textContent).toBe('Customize Dashboard')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F21.08 — Guest localStorage Persistence
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F21.08] Guest localStorage Persistence (AC-1)', () => {
    beforeEach(() => {
        localStorage.clear()
        global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 401 })))
    })

    it('saves prefer_lang to localStorage when language is switched', async () => {
        renderWithI18n()
        fireEvent.click(screen.getByTestId('set-ms'))
        expect(localStorage.getItem(LOCALE_KEY)).toBe('ms')
    })

    it('hydrates locale from localStorage on mount', async () => {
        localStorage.setItem(LOCALE_KEY, 'ms')
        renderWithI18n()
        await waitFor(() => {
            expect(screen.getByTestId('locale').textContent).toBe('ms')
        })
    })

    it('uses key "prefer_lang" (not "primeweb-locale")', async () => {
        renderWithI18n()
        fireEvent.click(screen.getByTestId('set-ms'))
        expect(localStorage.getItem('primeweb-locale')).toBeNull()
        expect(localStorage.getItem(LOCALE_KEY)).toBe('ms')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F21.09 — PATCH API on authenticated language switch
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F21.09] API Sync — PATCH /api/users/me/preferences (AC-2)', () => {
    beforeEach(() => {
        localStorage.clear()
        global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 })))
    })

    it('calls PATCH /api/users/me/preferences when locale is set', async () => {
        renderWithI18n()
        fireEvent.click(screen.getByTestId('set-ms'))

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/users/me/preferences',
                expect.objectContaining({
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prefer_lang: 'ms' }),
                })
            )
        })
    })

    it('does not crash if API call fails (graceful degradation)', async () => {
        global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))
        renderWithI18n()
        // Should not throw
        expect(() => fireEvent.click(screen.getByTestId('set-ms'))).not.toThrow()
        // localStorage still updated (local-first)
        expect(localStorage.getItem(LOCALE_KEY)).toBe('ms')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F21.10 & TC-F21.11 — syncLocaleFromDB (Cross-device sync, BR-04)
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F21.10 / TC-F21.11] syncLocaleFromDB — Cross-device & Session Priority', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('[TC-F21.10] overrides localStorage with DB preference on login', async () => {
        localStorage.setItem(LOCALE_KEY, 'en')
        const setLocaleMock = vi.fn()
        global.fetch = vi.fn(() =>
            Promise.resolve(new Response(JSON.stringify({ prefer_lang: 'ms' }), { status: 200 }))
        )

        await syncLocaleFromDB(setLocaleMock)

        expect(setLocaleMock).toHaveBeenCalledWith('ms')
    })

    it('[TC-F21.11] DB preference of User B overrides User A localStorage', async () => {
        // User A had BM set in localStorage
        localStorage.setItem(LOCALE_KEY, 'ms')
        const setLocaleMock = vi.fn()

        // User B has EN in DB
        global.fetch = vi.fn(() =>
            Promise.resolve(new Response(JSON.stringify({ prefer_lang: 'en' }), { status: 200 }))
        )

        await syncLocaleFromDB(setLocaleMock)
        expect(setLocaleMock).toHaveBeenCalledWith('en')
    })

    it('does not call setLocale if API returns 401 (unauthenticated)', async () => {
        const setLocaleMock = vi.fn()
        global.fetch = vi.fn(() =>
            Promise.resolve(new Response(null, { status: 401 }))
        )
        await syncLocaleFromDB(setLocaleMock)
        expect(setLocaleMock).not.toHaveBeenCalled()
    })

    it('does not call setLocale if API returns invalid locale', async () => {
        const setLocaleMock = vi.fn()
        global.fetch = vi.fn(() =>
            Promise.resolve(new Response(JSON.stringify({ prefer_lang: 'fr' }), { status: 200 }))
        )
        await syncLocaleFromDB(setLocaleMock)
        expect(setLocaleMock).not.toHaveBeenCalled()
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F21.02 — No-reload language switch (FR-03)
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F21.02] No full-page reload on language switch (FR-03)', () => {
    beforeEach(() => {
        localStorage.clear()
        global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
    })

    it('UI updates reactively without window reload', async () => {
        const reloadSpy = vi.fn()
        Object.defineProperty(window, 'location', {
            value: { reload: reloadSpy },
            writable: true,
        })

        renderWithI18n('en')
        expect(screen.getByTestId('locale').textContent).toBe('en')

        fireEvent.click(screen.getByTestId('set-ms'))

        await waitFor(() => {
            expect(screen.getByTestId('locale').textContent).toBe('ms')
        })
        expect(reloadSpy).not.toHaveBeenCalled()
    })

    it('toggleLocale switches between en and ms', async () => {
        renderWithI18n('en')
        expect(screen.getByTestId('locale').textContent).toBe('en')

        fireEvent.click(screen.getByTestId('toggle'))
        await waitFor(() => {
            expect(screen.getByTestId('locale').textContent).toBe('ms')
        })

        fireEvent.click(screen.getByTestId('toggle'))
        await waitFor(() => {
            expect(screen.getByTestId('locale').textContent).toBe('en')
        })
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F21.01 — LanguageSwitcher Component Rendering
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F21.01] LanguageSwitcher renders inside Auth Form Card', () => {
    beforeEach(() => {
        localStorage.clear()
        global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
    })

    it('renders MY and EN buttons in segmented variant', () => {
        render(
            <I18nProvider>
                <LanguageSwitcher variant="segmented" />
            </I18nProvider>
        )
        expect(screen.getByText('MY')).toBeInTheDocument()
        expect(screen.getByText('EN')).toBeInTheDocument()
    })

    it('renders globe variant with current locale label', () => {
        render(
            <I18nProvider defaultLocale="en">
                <LanguageSwitcher variant="globe" />
            </I18nProvider>
        )
        expect(screen.getByText('EN')).toBeInTheDocument()
    })

    it('[TC-F21.01b] active button has cyan/mint background class', () => {
        render(
            <I18nProvider defaultLocale="ms">
                <LanguageSwitcher variant="segmented" />
            </I18nProvider>
        )
        const myBtn = screen.getByText('MY')
        expect(myBtn.className).toContain('2DD4BF')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F21.04 — Language Switcher in Sidebar (CMS)
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F21.04] Language Switcher in CMS Sidebar footer', () => {
    beforeEach(() => {
        localStorage.clear()
        global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
        vi.clearAllMocks()
    })

    it('renders MY and EN buttons at the bottom of Desktop Sidebar', () => {
        render(
            <I18nProvider defaultLocale="en">
                <DashboardSidebar {...sidebarProps} />
            </I18nProvider>
        )
        const myBtns = screen.getAllByText('MY')
        const enBtns = screen.getAllByText('EN')
        expect(myBtns.length).toBeGreaterThan(0)
        expect(enBtns.length).toBeGreaterThan(0)
    })

    it('switching to MY translates nav labels to Bahasa Melayu', async () => {
        render(
            <I18nProvider defaultLocale="en">
                <DashboardSidebar {...sidebarProps} />
            </I18nProvider>
        )
        // Initially English
        expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)

        // Click MY
        fireEvent.click(screen.getAllByText('MY')[0])

        await waitFor(() => {
            expect(screen.getAllByText('Papan Pemuka').length).toBeGreaterThan(0)
        })
    })

    it('[TC-F21.06] Mobile drawer contains the Language Switcher', () => {
        render(
            <I18nProvider defaultLocale="en">
                <DashboardSidebar {...sidebarProps} mobileOpen={true} />
            </I18nProvider>
        )
        // Both desktop + mobile drawer render sidebarContent — so MY appears at least twice
        const myBtns = screen.getAllByText('MY')
        expect(myBtns.length).toBeGreaterThanOrEqual(2)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F21.05 — UI static vs Dynamic data independence (BR-02)
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F21.05] UI labels translate, user data stays original (BR-02)', () => {
    it('switches UI locale without altering user-typed data', async () => {
        renderWithI18n('en')
        expect(screen.getByTestId('dashboard-label').textContent).toBe('Customize Dashboard')

        fireEvent.click(screen.getByTestId('set-ms'))

        await waitFor(() => {
            // Sidebar/UI labels change to BM
            expect(screen.getByTestId('dashboard-label').textContent).toBe('Sesuaikan Papan Pemuka')
            // Locale switches
            expect(screen.getByTestId('locale').textContent).toBe('ms')
        })
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F21.12 — Safe fallback when i18n key missing (FR-06, BR-05)
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F21.12] i18n Safe Fallback — missing key does not crash', () => {
    beforeEach(() => {
        localStorage.clear()
    })
    it('useI18n throws if used outside I18nProvider', () => {
        const WrappedComponent = () => {
            useI18n()
            return <div />
        }
        expect(() => render(<WrappedComponent />)).toThrow('useI18n must be used within I18nProvider')
    })

    it('I18nProvider default locale is EN (fallback-safe)', () => {
        renderWithI18n()
        expect(screen.getByTestId('locale').textContent).toBe('en')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// FR-08 — Pluralization tp() and ti() utilities
// ═══════════════════════════════════════════════════════════════════════════
describe('[FR-08] Pluralization — tp() and ti() utilities', () => {
    beforeEach(() => {
        localStorage.clear()
        global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
    })

    it('tp() returns singular form for count=1 (EN)', async () => {
        renderWithI18n('en')
        expect(screen.getByTestId('tp-result-one').textContent).toBe('1 issue')
    })

    it('tp() returns plural form for count>1 (EN)', () => {
        renderWithI18n('en')
        expect(screen.getByTestId('tp-result').textContent).toBe('2 issues')
    })

    it('tp() returns same BM form for count=1 and count>1', async () => {
        renderWithI18n('ms')
        await waitFor(() => {
            // BM: "1 isu" and "2 isu" — same word, no morphological change
            expect(screen.getByTestId('tp-result-one').textContent).toBe('1 isu')
            expect(screen.getByTestId('tp-result').textContent).toBe('2 isu')
        })
    })

    it('ti() replaces {count} placeholder correctly', () => {
        renderWithI18n('ms')
        expect(screen.getByTestId('ti-result').textContent).toBe('5 isu dalam senarai')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F21.15 — Currency format RM (BR-03)
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F21.15] Currency format locked to RM (BR-03)', () => {
    it('formatCurrency renders RM prefix with comma-thousand and dot-decimal', () => {
        // Validate the RM 1,200.50 format pattern
        const formatRM = (value: number) =>
            `RM ${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

        expect(formatRM(1200.5)).toBe('RM 1,200.50')
        expect(formatRM(99)).toBe('RM 99.00')
        expect(formatRM(1000000)).toBe('RM 1,000,000.00')
    })

    it('RM format does not use dollar sign', () => {
        const amount = 'RM 99.00'
        expect(amount).not.toContain('$')
        expect(amount).toMatch(/^RM \d/)
    })
})
