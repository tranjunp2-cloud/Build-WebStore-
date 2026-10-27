import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import '@testing-library/jest-dom'

// ── Mocks ─────────────────────────────────────────────────────────────

// Mock router
vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn() })),
    usePathname: vi.fn(() => '/dashboard'),
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
                    title: "Welcome to Web Store",
                    subtitle: "Start building your store. Complete it in just 5 minutes.",
                    createStore: "Create My Store",
                    skip: "Skip & Go to Dashboard",
                    step: "Step 1 of 2: Create Store"
                },
                v2Intro: {
                    badge: "WebStore V2",
                    title: "Your store has moved to Web Store",
                    description: "V2 is now the only place to manage your store.",
                    getStarted: "Get started",
                    close: "Close",
                    videoComingSoon: "Video coming soon",
                    video: {
                        play: "Play video",
                        pause: "Pause",
                        replay: "Replay",
                        seek: "Seek",
                        mute: "Mute",
                        unmute: "Unmute",
                        fullScreen: "Full screen",
                        exitFullScreen: "Exit full screen"
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

// ── TC-F06.04 & F06.09: V2 intro popup (AIDiscoveryWizard) ──────────────
describe('AIDiscoveryWizard', () => {
    const originalFetch = global.fetch
    const TITLE = 'Your store has moved to Web Store'
    const dismissCall = ['/api/user/dismiss-wizard', expect.objectContaining({ method: 'POST', credentials: 'include' })] as const

    beforeEach(() => {
        vi.clearAllMocks()
        document.body.style.overflow = ''
        // jsdom has no media playback
        vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ success: true })
        })
    })

    afterEach(() => {
        global.fetch = originalFetch
        vi.restoreAllMocks()
    })

    it('[TC-F06.04] Popup mở tự động: badge, tiêu đề, video có poster, nút Get started', () => {
        const { container } = render(<AIDiscoveryWizard userId="u-123" />)

        expect(screen.getByRole('dialog', { name: TITLE })).toBeVisible()
        expect(screen.getByText('WebStore V2')).toBeVisible()
        expect(screen.getByRole('button', { name: /Get started/ })).toBeVisible()

        const video = container.querySelector('video')
        expect(video).toHaveAttribute('src', '/videos/v2-intro.mp4')
        expect(video).toHaveAttribute('poster', '/videos/v2-intro-poster.jpg')
        expect(video).toHaveAttribute('preload', 'metadata')
        // Never autoplays with sound
        expect(video).not.toHaveAttribute('autoplay')
        expect(screen.getByRole('button', { name: 'Play video' })).toBeVisible()
        expect(screen.getByRole('slider', { name: 'Seek' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Mute' })).toBeVisible()
        expect(screen.getByRole('button', { name: 'Full screen' })).toBeVisible()
    })

    it.each([
        ['Get started', () => fireEvent.click(screen.getByRole('button', { name: /Get started/ }))],
        ['X', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
        ['backdrop', () => fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)],
        ['Esc', () => fireEvent.keyDown(document, { key: 'Escape' })],
    ])('[TC-F06.09] Đóng bằng %s → persist has_seen_ai_wizard + phát wizard-closed', async (_label, closeAction) => {
        const wizardClosedSpy = vi.fn()
        window.addEventListener('wizard-closed', wizardClosedSpy)
        try {
            render(<AIDiscoveryWizard userId="u-123" />)
            closeAction()

            expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
            await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(...dismissCall))
            expect(global.fetch).toHaveBeenCalledTimes(1)
            // PushOptInPrompt takes its turn after this event
            expect(wizardClosedSpy).toHaveBeenCalledTimes(1)
            expect(wizardClosedSpy.mock.calls[0][0].detail).toEqual({ permanent: true })
        } finally {
            window.removeEventListener('wizard-closed', wizardClosedSpy)
        }
    })

    it('[TC-F06.09] Click bên trong popup (video, nội dung) không đóng popup', () => {
        render(<AIDiscoveryWizard userId="u-123" />)

        fireEvent.click(screen.getByRole('dialog'))
        fireEvent.click(screen.getByText(TITLE))

        expect(screen.getByRole('dialog')).toBeVisible()
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it('[TC-F06.12] Check trạng thái cho Legacy Users (Wizard Guard)', () => {
        // The has_seen_ai_wizard gate lives in app/(dashboard)/layout.tsx; this mirrors it.
        const mockDashboardLayoutLogic = (hasSeenWizard: boolean) => {
            if (!hasSeenWizard) return <AIDiscoveryWizard userId="legacy" />
            return <div data-testid="dashboard-content">Dashboard Content</div>
        }

        render(mockDashboardLayoutLogic(true))

        expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
        expect(screen.getByTestId('dashboard-content')).toBeVisible()
    })

    it('[TC-F06.21] Đã đóng thì không mở lại khi re-render (soft-nav quay về /dashboard)', () => {
        const { rerender } = render(<AIDiscoveryWizard userId="u-123" />)
        fireEvent.click(screen.getByRole('button', { name: 'Close' }))

        rerender(<AIDiscoveryWizard userId="u-123" />)

        expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
    })

    it('[TC-F06.23] Body overflow là hidden khi popup mở và restore sau khi đóng', () => {
        render(<AIDiscoveryWizard userId="u-123" />)

        expect(document.body.style.overflow).toBe('hidden')

        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
        expect(document.body.style.overflow).toBe('')
    })

    it('[TC-F06.16] Video lỗi → hiện "Video coming soon", không crash', () => {
        const { container } = render(<AIDiscoveryWizard userId="u-123" />)
        expect(screen.queryByText('Video coming soon')).not.toBeInTheDocument()

        fireEvent.error(container.querySelector('video') as HTMLVideoElement)

        expect(screen.getByText('Video coming soon')).toBeVisible()
        expect(screen.getByRole('button', { name: /Get started/ })).toBeVisible()
    })

    it('[TC-F06.19] Security Integrity - Unauthorized Patch Fallback', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        global.fetch = vi.fn().mockImplementationOnce(() => Promise.reject(new Error('403 Forbidden')))

        render(<AIDiscoveryWizard userId="unauthorized-user" />)
        fireEvent.click(screen.getByRole('button', { name: /Get started/ }))

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled()
            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to persist wizard dismiss state', expect.any(Error))
        })

        consoleErrorSpy.mockRestore()
    })
})
