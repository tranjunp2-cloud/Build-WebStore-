/**
 * Onboarding Checklist & Setup Alert Tests — F03 Dashboard
 * Coverage Map (QA Doc Traceability):
 *   TC-F03.58  → DashboardOnboarding returns null when all 4 tasks done
 *   TC-F03.59  → First incomplete step shows "Continue" button; completed steps show CheckCircle2
 *   TC-F03.60  → Progress % = (completedCount / 4) * 100
 *   TC-F03.61  → SetupAlertBanner rendered when hasPaymentConfigured=false
 *   TC-F03.62  → SetupAlertBanner renders when hasPaymentConfigured=false
 *   TC-F03.63  → SetupAlertBanner returns null when hasPaymentConfigured=true
 *   TC-F03.64  → "I'll do this later" button writes sessionStorage + hides banner
 *   TC-F03.65  → "Complete Setup" link href="/settings/payments"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ── Mock next/navigation ─────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
    usePathname: () => '/dashboard',
    useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

// ── Mock next/link ──────────────────────────────────────────────────────────
vi.mock('next/link', () => ({
    default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
        React.createElement('a', { href, className }, children),
}))

// ── Mock @/i18n ──────────────────────────────────────────────────────────────
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            dashboard: {
                onboarding: {
                    title: 'Get Your Store Ready',
                    subtitle: 'Complete these steps to launch your store',
                    completeLabel: 'Complete',
                    continueBtn: 'Continue',
                    steps: {
                        products: { label: 'Add Your First Product', description: 'Create your product catalog' },
                        design: { label: 'Customize Your Store Design', description: 'Choose colors, fonts, and layout' },
                        payment: { label: 'Set Up Payment & Shipping', description: 'Configure payment methods and shipping options' },
                        publish: { label: 'Publish Your Website', description: 'Make your store live' },
                    },
                    banner: {
                        title: 'Your Store is Almost Ready!',
                        description: 'Complete the payment setup to publish your website and start selling online.',
                        completeBtn: 'Complete Setup',
                        dismissBtn: "I'll do this later",
                    },
                },
            },
        },
        locale: 'en',
    }),
}))

// ── Imports after mocks ──────────────────────────────────────────────────────
import { DashboardOnboarding } from '@/components/dashboard/DashboardOnboarding'
import { SetupAlertBanner } from '@/components/dashboard/SetupAlertBanner'

// ─────────────────────────────────────────────────────────────────────────────
// DashboardOnboarding Tests
// ─────────────────────────────────────────────────────────────────────────────
describe('[TC-F03.58] DashboardOnboarding — Null when all tasks complete', () => {
    it('returns null when all 4 tasks are done', () => {
        const { container } = render(
            <DashboardOnboarding

                hasPublishedSite={true}
                hasProducts={true}
                isDesignCustomized={true}
                hasPaymentConfigured={true}
            />
        )

        expect(container.firstChild).toBeNull()
    })

    it('renders checklist when at least 1 task incomplete', () => {
        render(
            <DashboardOnboarding

                hasPublishedSite={false}
                hasProducts={true}
                isDesignCustomized={true}
                hasPaymentConfigured={true}
            />
        )

        expect(screen.getByText('Get Your Store Ready')).toBeInTheDocument()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('[TC-F03.59] DashboardOnboarding — Step States (active/completed/locked)', () => {
    it('first incomplete step shows "Continue" button; completed steps show CheckCircle2; locked steps have no button', () => {
        // Arrange: first step incomplete (hasProducts=false), step 2 complete, step 3+ locked
        const { container } = render(
            <DashboardOnboarding

                hasPublishedSite={false}
                hasProducts={false}
                isDesignCustomized={true}
                hasPaymentConfigured={false}
            />
        )

        // Act & Assert: step 1 (active/incomplete) has "Continue" button
        const continueButton = screen.getByRole('link', { name: /continue/i })
        expect(continueButton).toBeInTheDocument()
        expect(continueButton).toHaveAttribute('href', '/products/new')

        // step 2 is completed, should have green CheckCircle2 and green text styling
        expect(screen.getByText('Customize Your Store Design')).toBeInTheDocument()
        const customizeText = screen.getByText('Customize Your Store Design')
        expect(customizeText).toHaveClass('text-[hsl(var(--success))]')

        // step 3 is locked (comes after first incomplete), should have gray/disabled styling and no button
        const paymentDiv = screen.getByText('Set Up Payment & Shipping').closest('div[class*="rounded-xl"]')
        expect(paymentDiv).toHaveClass('bg-dash-secondary-bg')
        expect(paymentDiv).not.toContainHTML('button')
    })

    it('completed step uses CheckCircle2 (green svg), active uses Clock (blue svg), locked uses Circle (muted svg)', () => {
        // hasProducts=false (active), isDesignCustomized=true (completed), others=false (locked)
        const { container } = render(
            <DashboardOnboarding
                hasPublishedSite={false}
                hasProducts={false}
                isDesignCustomized={true}
                hasPaymentConfigured={false}
            />
        )

        // Completed step: svg with success token text class (CheckCircle2)
        const completedSvg = container.querySelector('svg.text-\\[hsl\\(var\\(--success\\)\\)\\]')
        expect(completedSvg).toBeInTheDocument()

        // Active step: svg with primary token text class (Clock)
        const activeSvg = container.querySelector('svg.text-\\[hsl\\(var\\(--primary\\)\\)\\]')
        expect(activeSvg).toBeInTheDocument()

        // Locked step: svg with muted text class (Circle)
        const lockedSvg = container.querySelector('svg.text-dash-text-muted')
        expect(lockedSvg).toBeInTheDocument()
    })

    it('renders all 4 step labels in correct order', () => {
        render(
            <DashboardOnboarding

                hasPublishedSite={false}
                hasProducts={false}
                isDesignCustomized={false}
                hasPaymentConfigured={false}
            />
        )

        expect(screen.getByText('Add Your First Product')).toBeInTheDocument()
        expect(screen.getByText('Customize Your Store Design')).toBeInTheDocument()
        expect(screen.getByText('Set Up Payment & Shipping')).toBeInTheDocument()
        expect(screen.getByText('Publish Your Website')).toBeInTheDocument()
    })

    it('all completed steps show CheckCircle2 green styling', () => {
        render(
            <DashboardOnboarding

                hasPublishedSite={true}
                hasProducts={true}
                isDesignCustomized={true}
                hasPaymentConfigured={true}
            />
        )

        // When all complete, component returns null
        // This is tested in TC-F03.58
    })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('[TC-F03.60] DashboardOnboarding — Progress Percentage Math', () => {
    it('displays 0% when no tasks completed', () => {
        render(
            <DashboardOnboarding

                hasPublishedSite={false}
                hasProducts={false}
                isDesignCustomized={false}
                hasPaymentConfigured={false}
            />
        )

        expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('displays 25% when 1/4 tasks completed', () => {
        render(
            <DashboardOnboarding

                hasPublishedSite={false}
                hasProducts={true}
                isDesignCustomized={false}
                hasPaymentConfigured={false}
            />
        )

        expect(screen.getByText('25%')).toBeInTheDocument()
    })

    it('displays 50% when 2/4 tasks completed', () => {
        render(
            <DashboardOnboarding

                hasPublishedSite={false}
                hasProducts={true}
                isDesignCustomized={true}
                hasPaymentConfigured={false}
            />
        )

        expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('displays 75% when 3/4 tasks completed', () => {
        render(
            <DashboardOnboarding

                hasPublishedSite={false}
                hasProducts={true}
                isDesignCustomized={true}
                hasPaymentConfigured={true}
            />
        )

        expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('returns null (component hidden) when 4/4 tasks completed (100%)', () => {
        const { container } = render(
            <DashboardOnboarding

                hasPublishedSite={true}
                hasProducts={true}
                isDesignCustomized={true}
                hasPaymentConfigured={true}
            />
        )

        expect(container.firstChild).toBeNull()
    })

    it('progress bar width matches percentage', () => {
        const { container } = render(
            <DashboardOnboarding

                hasPublishedSite={false}
                hasProducts={true}
                isDesignCustomized={false}
                hasPaymentConfigured={false}
            />
        )

        // 1/4 = 25%
        const progressBarFill = container.querySelector(
            'div.bg-gradient-to-r.from-\\[hsl\\(var\\(--info\\)\\)\\].to-\\[hsl\\(var\\(--primary\\)\\)\\]'
        ) as HTMLElement
        expect(progressBarFill).toHaveStyle({ width: '25%' })
    })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('[TC-F03.61] DashboardOnboarding — SetupAlertBanner Integration', () => {
    beforeEach(() => {
        sessionStorage.clear()
        vi.clearAllMocks()
    })

    afterEach(() => {
        sessionStorage.clear()
    })

    it('renders SetupAlertBanner when hasPaymentConfigured=false', () => {
        render(
            <DashboardOnboarding

                hasPublishedSite={false}
                hasProducts={true}
                isDesignCustomized={true}
                hasPaymentConfigured={false}
            />
        )

        expect(screen.getByText(/Your Store is Almost Ready/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Complete Setup/i })).toBeInTheDocument()
    })

    it('does not render SetupAlertBanner when hasPaymentConfigured=true', () => {
        render(
            <DashboardOnboarding

                hasPublishedSite={false}
                hasProducts={true}
                isDesignCustomized={true}
                hasPaymentConfigured={true}
            />
        )

        // SetupAlertBanner should not be visible
        expect(screen.queryByText(/Your Store is Almost Ready/)).not.toBeInTheDocument()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// SetupAlertBanner Tests
// ─────────────────────────────────────────────────────────────────────────────
describe('[TC-F03.62] SetupAlertBanner — Renders when !hasPaymentConfigured', () => {
    beforeEach(() => {
        sessionStorage.clear()
        vi.clearAllMocks()
    })

    afterEach(() => {
        sessionStorage.clear()
    })

    it('renders banner with all text and buttons when hasPaymentConfigured=false', () => {
        render(<SetupAlertBanner hasPaymentConfigured={false} />)

        expect(screen.getByText(/Your Store is Almost Ready/)).toBeInTheDocument()
        expect(screen.getByText(/Complete the payment setup/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Complete Setup/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /I'll do this later/i })).toBeInTheDocument()
    })

    it('renders with correct structure and styling classes', () => {
        const { container } = render(<SetupAlertBanner hasPaymentConfigured={false} />)

        const banner = container.querySelector('div[class*="rounded-2xl"]')
        expect(banner).toBeInTheDocument()
        expect(banner).toHaveClass('border-[hsl(var(--info)/0.4)]')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('[TC-F03.63] SetupAlertBanner — Returns null when hasPaymentConfigured=true', () => {
    beforeEach(() => {
        sessionStorage.clear()
        vi.clearAllMocks()
    })

    afterEach(() => {
        sessionStorage.clear()
    })

    it('returns null (no render) when hasPaymentConfigured=true', () => {
        const { container } = render(<SetupAlertBanner hasPaymentConfigured={true} />)

        expect(container.firstChild).toBeNull()
    })

    it('returns null when already dismissed (sessionStorage set)', () => {
        sessionStorage.setItem('onboarding_banner_dismissed', 'true')

        const { container } = render(<SetupAlertBanner hasPaymentConfigured={false} />)

        expect(container.firstChild).toBeNull()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('[TC-F03.64] SetupAlertBanner — Dismiss Action (sessionStorage + hide)', () => {
    beforeEach(() => {
        sessionStorage.clear()
        vi.clearAllMocks()
    })

    afterEach(() => {
        sessionStorage.clear()
    })

    it('clicking "I\'ll do this later" writes sessionStorage and hides banner', async () => {
        const { container, rerender } = render(<SetupAlertBanner hasPaymentConfigured={false} />)

        // Arrange: banner should be visible
        expect(screen.getByText(/Your Store is Almost Ready/)).toBeInTheDocument()

        // Act: click dismiss button
        const dismissButton = screen.getByRole('button', { name: /I'll do this later/i })
        fireEvent.click(dismissButton)

        // Assert: sessionStorage should be set
        expect(sessionStorage.getItem('onboarding_banner_dismissed')).toBe('true')

        // Banner should disappear after click
        expect(screen.queryByText(/Your Store is Almost Ready/)).not.toBeInTheDocument()
    })

    it('banner stays hidden on re-render after dismiss', () => {
        const { rerender } = render(<SetupAlertBanner hasPaymentConfigured={false} />)

        // Click dismiss
        const dismissButton = screen.getByRole('button', { name: /I'll do this later/i })
        fireEvent.click(dismissButton)

        // Re-render with same props
        rerender(<SetupAlertBanner hasPaymentConfigured={false} />)

        // Banner should still be hidden because sessionStorage persists
        expect(screen.queryByText(/Your Store is Almost Ready/)).not.toBeInTheDocument()
    })

    it('initializes state from sessionStorage on mount', () => {
        // Pre-set sessionStorage
        sessionStorage.setItem('onboarding_banner_dismissed', 'true')

        const { container } = render(<SetupAlertBanner hasPaymentConfigured={false} />)

        // Banner should not render because dismissed state was restored from sessionStorage
        expect(container.firstChild).toBeNull()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('[TC-F03.65] SetupAlertBanner — "Complete Setup" Link href', () => {
    beforeEach(() => {
        sessionStorage.clear()
        vi.clearAllMocks()
    })

    afterEach(() => {
        sessionStorage.clear()
    })

    it('"Complete Setup" link points to /settings/payments', () => {
        render(<SetupAlertBanner hasPaymentConfigured={false} />)

        const completeSetupLink = screen.getByRole('link', { name: /Complete Setup/i })
        expect(completeSetupLink).toHaveAttribute('href', '/settings/payments')
    })

    it('link is keyboard accessible', () => {
        render(<SetupAlertBanner hasPaymentConfigured={false} />)

        const completeSetupLink = screen.getByRole('link', { name: /Complete Setup/i })
        expect(completeSetupLink.tagName).toBe('A')
    })
})
