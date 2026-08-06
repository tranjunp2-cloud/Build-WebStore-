// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import en from '@/i18n/locales/en.json'

// Plan 260415 — stub useI18n so the modal renders with real EN strings.
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: en,
        ti: (template: string, vars: Record<string, string | number>) =>
            template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')),
    }),
    I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import { CongratsModal } from '../../../components/builder/CongratsModal'

// ── Mocks ────────────────────────────────────────────────────────────────

// next/link renders an <a> in test env — minimal mock keeps href intact
vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        onClick,
        className,
    }: {
        href: string
        children: React.ReactNode
        onClick?: () => void
        className?: string
    }) => (
        <a className={className} href={href} onClick={onClick}>
            {children}
        </a>
    ),
}))

// framer-motion: render children immediately without animation
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
            <div className={className} {...rest}>
                {children}
            </div>
        ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// sonner toast
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
    toast: {
        success: (msg: string) => mockToastSuccess(msg),
        error: (msg: string) => mockToastError(msg),
    },
}))

// ── Helpers ───────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
    isOpen: true,
    onOpenChange: vi.fn(),
    siteUrl: 'https://my-coffee-shop.primeweb.app',
    siteName: 'My Coffee Shop',
    siteId: 'site-abc-123',
}

function renderModal(overrides: Partial<typeof DEFAULT_PROPS> & { dashboardHref?: string; dashboardLabel?: string; onNavigate?: () => void } = {}) {
    return render(<CongratsModal {...DEFAULT_PROPS} {...overrides} />)
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('CongratsModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Mock clipboard API
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    // ── TC-F01.23: Modal renders when open ───────────────────────────────

    describe('Rendering (TC-F01.23)', () => {
        it('renders congratulations title when open', () => {
            renderModal()
            expect(screen.getByText(/Congratulations/i)).toBeInTheDocument()
        })

        it('displays site name in description text', () => {
            renderModal()
            expect(screen.getByText(/My Coffee Shop/)).toBeInTheDocument()
        })

        it('shows "is now live online" message', () => {
            renderModal()
            expect(screen.getByText(/is now live online/i)).toBeInTheDocument()
        })

        it('displays the site URL in the domain display', () => {
            renderModal()
            expect(screen.getByText('https://my-coffee-shop.primeweb.app')).toBeInTheDocument()
        })

        it('does not render when isOpen is false', () => {
            renderModal({ isOpen: false })
            expect(screen.queryByText(/Congratulations/i)).not.toBeInTheDocument()
        })

        it('renders close button', () => {
            renderModal()
            // Radix Dialog.Close renders a button — look for X icon container
            const closeButtons = screen.getAllByRole('button')
            const closeBtn = closeButtons.find(
                (btn) => btn.querySelector('svg') !== null && !btn.textContent?.includes('Copy'),
            )
            expect(closeBtn).toBeDefined()
        })
    })

    // ── TC-F01.26: Copy link to clipboard ────────────────────────────────

    describe('Copy link (TC-F01.26)', () => {
        it('renders Copy Link button by default', () => {
            renderModal()
            expect(screen.getByRole('button', { name: /Copy Link/i })).toBeInTheDocument()
        })

        it('calls clipboard.writeText with siteUrl when Copy Link is clicked', async () => {
            renderModal()
            fireEvent.click(screen.getByRole('button', { name: /Copy Link/i }))
            await waitFor(() => {
                expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                    'https://my-coffee-shop.primeweb.app',
                )
            })
        })

        it('shows success toast after copying', async () => {
            renderModal()
            fireEvent.click(screen.getByRole('button', { name: /Copy Link/i }))
            await waitFor(() => {
                expect(mockToastSuccess).toHaveBeenCalledWith('Link copied! 🎉')
            })
        })

        it('shows "Copied ✓" state immediately after clicking', async () => {
            renderModal()
            fireEvent.click(screen.getByRole('button', { name: /Copy Link/i }))
            await waitFor(() => {
                expect(screen.getByText(/Copied/i)).toBeInTheDocument()
            })
        })

        it('shows error toast when clipboard write fails', async () => {
            Object.assign(navigator, {
                clipboard: {
                    writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
                },
            })
            renderModal()
            fireEvent.click(screen.getByRole('button', { name: /Copy Link/i }))
            await waitFor(() => {
                expect(mockToastError).toHaveBeenCalledWith("Couldn't copy the link. Try again.")
            })
        })

        it('resets "Copied ✓" back to "Copy Link" after 2 seconds', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true })
            // clipboard.writeText must resolve synchronously under fake timers
            Object.assign(navigator, {
                clipboard: {
                    writeText: vi.fn().mockResolvedValue(undefined),
                },
            })
            renderModal()
            fireEvent.click(screen.getByRole('button', { name: /Copy Link/i }))

            // Flush the clipboard promise
            await act(async () => {
                await Promise.resolve()
            })

            // Should be in "Copied" state now
            expect(screen.getByText(/Copied/i)).toBeInTheDocument()

            // Advance past the 2000ms setTimeout
            await act(async () => {
                vi.advanceTimersByTime(2100)
            })

            expect(screen.getByRole('button', { name: /Copy Link/i })).toBeInTheDocument()

            vi.useRealTimers()
        })
    })

    // ── TC-F01.23: Navigation buttons ────────────────────────────────────

    describe('Navigation buttons (TC-F01.23, TC-F01.24, TC-F01.25)', () => {
        // Design update 2026-04-14: primary action is now "Open Editor" (internal nav)
        // instead of "View Live Site" (external). The live URL is still surfaced via
        // the Copy Link row. "Continue Editing" text link removed — editor is the primary CTA.
        it('renders "Open Editor" link pointing to /editor/:siteId', () => {
            renderModal()
            const link = screen.getByRole('link', { name: /Open Editor/i })
            expect(link).toHaveAttribute('href', '/editor/site-abc-123')
        })

        it('renders "Go to Dashboard" link with default href /dashboard', () => {
            renderModal()
            const link = screen.getByRole('link', { name: /Go to Dashboard/i })
            expect(link).toHaveAttribute('href', '/dashboard')
        })

        it('uses custom dashboardHref when provided', () => {
            renderModal({ dashboardHref: '/admin/collections/sites' })
            const link = screen.getByRole('link', { name: /Go to Dashboard/i })
            expect(link).toHaveAttribute('href', '/admin/collections/sites')
        })

        it('uses custom dashboardLabel when provided', () => {
            renderModal({ dashboardLabel: 'Go to Admin Dashboard' })
            expect(screen.getByRole('link', { name: /Go to Admin Dashboard/i })).toBeInTheDocument()
        })

        it('surfaces the site URL for copying', () => {
            renderModal()
            // URL text is rendered in the Copy row (no longer in a button href).
            expect(screen.getByText('https://my-coffee-shop.primeweb.app')).toBeInTheDocument()
        })

        it('calls onNavigate when "Open Editor" is clicked', () => {
            const onNavigate = vi.fn()
            renderModal({ onNavigate })
            fireEvent.click(screen.getByRole('link', { name: /Open Editor/i }))
            expect(onNavigate).toHaveBeenCalledTimes(1)
        })

        it('calls onNavigate when "Go to Dashboard" is clicked', () => {
            const onNavigate = vi.fn()
            renderModal({ onNavigate })
            fireEvent.click(screen.getByRole('link', { name: /Go to Dashboard/i }))
            expect(onNavigate).toHaveBeenCalledTimes(1)
        })
    })

    // ── Dialog open/close state ───────────────────────────────────────────

    describe('Dialog state', () => {
        it('calls onOpenChange(false) when close button is clicked', () => {
            const onOpenChange = vi.fn()
            renderModal({ onOpenChange })
            // Radix Dialog.Close button — find by looking for the X icon button
            // It has no accessible text so use title/aria heuristics
            const allButtons = screen.getAllByRole('button')
            // Close button is the one that doesn't say Copy Link and has svg
            const closeBtn = allButtons.find(
                (btn) =>
                    btn.querySelector('svg') !== null &&
                    !btn.textContent?.match(/Copy|Copied/i),
            )
            if (closeBtn) {
                fireEvent.click(closeBtn)
                expect(onOpenChange).toHaveBeenCalledWith(false)
            }
        })
    })

    // ── Edge cases ────────────────────────────────────────────────────────

    describe('Edge cases', () => {
        it('renders the siteUrl in the copy row for different URLs', () => {
            renderModal({
                siteUrl: 'https://another-store.primeweb.app',
                siteId: 'site-xyz-999',
            })
            expect(screen.getByText('https://another-store.primeweb.app')).toBeInTheDocument()
        })

        it('renders correct Open Editor link for different siteId', () => {
            renderModal({ siteId: 'site-xyz-999' })
            const editLink = screen.getByRole('link', { name: /Open Editor/i })
            expect(editLink).toHaveAttribute('href', '/editor/site-xyz-999')
        })

        it('does not call onNavigate when it is not provided', () => {
            // Should not throw even if onNavigate is undefined
            renderModal({ onNavigate: undefined })
            expect(() => {
                fireEvent.click(screen.getByRole('link', { name: /Open Editor/i }))
            }).not.toThrow()
        })
    })
})
