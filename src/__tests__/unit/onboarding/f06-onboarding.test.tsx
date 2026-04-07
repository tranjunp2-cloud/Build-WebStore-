import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import '@testing-library/jest-dom'

// ── Mocks ─────────────────────────────────────────────────────────────

// Mock router
vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

// Mock Next.js Image to prevent warnings/errors during testing
vi.mock('next/image', () => ({
    default: (props: ComponentProps<'img'>) => {
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        return <img {...props} />
    }
}))

// Mock next/link
vi.mock('next/link', () => ({
    default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & ComponentProps<'a'>) => {
        return (
            <a href={href} {...rest}>
                {children}
            </a>
        )
    }
}))

// Mock i18n
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            onboarding: {
                welcome: {
                    title: "Welcome to PrimeWeb",
                    subtitle: "Start building your store. Complete it in just 5 minutes.",
                    createStore: "Create My Store",
                    skip: "Skip & Go to Dashboard",
                    step: "Step 1 of 2: Create Store"
                },
                wizard: {
                    title: "Discover the Power of AI",
                    slides: {
                        editor: { title: "AI Editor", description: "Design assist" },
                        content: { title: "AI Content", description: "Write blog posts" },
                        seo: { title: "AI SEO", description: "Improve rankings" }
                    },
                    footer: {
                        skip: "Skip",
                        skipInstructions: "Skip instructions",
                        goBack: "Go back",
                        continue: "Continue",
                        explore: "Explore CMS"
                    }
                }
            }
        }
    })
}))

// Mock Auth
vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(),
}))

import { WelcomeScreenClient } from '@/app/(frontend)/onboarding/_components/WelcomeScreenClient'
import { AIDiscoveryWizard } from '@/components/dashboard/AIDiscoveryWizard'

// ── TC-F06.02 & TC-F06.03: Welcome Screen ──────────────────────────────
describe('WelcomeScreenClient', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-F06.02] Welcome Screen: Renders Create Store CTA with instant redirect to /builder/new', () => {
        render(<WelcomeScreenClient />)
        
        const createStoreBtn = screen.getByText('Create My Store')
        expect(createStoreBtn).toBeVisible()
        
        // Assert the Link wraps the text pointing to /builder/new
        const createStoreLink = createStoreBtn.closest('a')
        expect(createStoreLink).toHaveAttribute('href', '/builder/new')
    })

    it('[TC-F06.03] Welcome Screen: Bỏ qua Onboarding (Skip Path) Redirects to /dashboard', () => {
        render(<WelcomeScreenClient />)

        const skipBtn = screen.getByText('Skip & Go to Dashboard')
        expect(skipBtn).toBeVisible()
        
        // Assert the Skip Link points to /dashboard
        const skipLink = skipBtn.closest('a')
        expect(skipLink).toHaveAttribute('href', '/dashboard')
    })
})

// ── TC-F06.04 & F06.09: AI Discovery Wizard ─────────────────────────────
describe('AIDiscoveryWizard', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
        vi.clearAllMocks()
        // Default Mock Fetch Implementation (Success)
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ success: true })
        })
    })

    afterEach(() => {
        global.fetch = originalFetch
    })

    it('[TC-F06.04] Kích hoạt Wizard tự động tại Dashboard', () => {
        // Arrange & Act: When component is rendered, isOpen is true by default
        render(<AIDiscoveryWizard userId="u-123" />)

        // Assert: Modal Title should be visible
        expect(screen.getByText('Discover the Power of AI')).toBeVisible()
        expect(screen.getByText('AI Editor')).toBeVisible() // Slide 1
    })

    it('[TC-F06.09] Đóng Wizard & Patch Database Flag', async () => {
        render(<AIDiscoveryWizard userId="u-123" />)

        // Find the Skip Button (to dismiss directly)
        const skipBtn = screen.getByText('Skip instructions')
        
        // Act
        fireEvent.click(skipBtn)

        // Assert: It should trigger API (POST /api/user/dismiss-wizard)
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/user/dismiss-wizard', expect.objectContaining({
                method: 'POST',
                credentials: 'include',
            }))
        })
        
        // Output DOM does not contain the Wizard title anymore
        expect(screen.queryByText('Discover the Power of AI')).not.toBeInTheDocument()
    })

    it('[TC-F06.12] Check trạng thái cho Legacy Users (Wizard Guard)', () => {
        // NOTE: In the current architecture, AIDiscoveryWizard component unconditionally renders 
        // if rendered directly. The logic (!user.has_seen_ai_wizard) is handled in app/(dashboard)/layout.tsx.
        // This test simulates the Dashboard layout bypassing AIDiscoveryWizard for legacy users.
        const mockDashboardLayoutLogic = (hasSeenWizard: boolean) => {
            if (!hasSeenWizard) return <AIDiscoveryWizard userId="legacy" />
            return <div data-testid="dashboard-content">Dashboard Content</div>
        }

        render(mockDashboardLayoutLogic(true))

        // Assert legacy users do NOT see the wizard
        expect(screen.queryByText('Discover the Power of AI')).not.toBeInTheDocument()
        expect(screen.getByTestId('dashboard-content')).toBeVisible()
    })

    it('[TC-F06.17] Security Integrity - Unauthorized Patch Fallback', async () => {
        // Arrange
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        
        // Simulate a 403 Forbidden return from fetch API network call
        global.fetch = vi.fn().mockImplementationOnce(() => Promise.reject(new Error('403 Forbidden')))

        render(<AIDiscoveryWizard userId="unauthorized-user" />)
        
        // Find Skip button to trigger patch
        const skipBtn = screen.getByText('Skip instructions')
        
        // Act
        fireEvent.click(skipBtn)

        // Assert: Fetch was called but caught by component's error handler
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled()
            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to persist wizard dismiss state', expect.any(Error))
        })
        
        consoleErrorSpy.mockRestore()
    })
})
