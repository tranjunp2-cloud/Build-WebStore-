// TC-F03.71: CustomizeModal locks/restores body scroll on open/close (GH-1491 issue 1).

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Mocks (must be top-level, before imports) ─────────────────────────────────

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/app/(dashboard)/actions', () => ({
    updateDashboardPreferences: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            dashboard: {
                revamp: {
                    soon: 'Soon',
                    customize: {
                        button: 'Customize',
                        title: 'Customize dashboard',
                        description: 'Show, hide, or reorder blocks',
                        reset: 'Reset',
                        cancel: 'Cancel',
                        save: 'Save changes',
                        saving: 'Saving…',
                        saved: 'Saved',
                        saveError: 'Failed to save',
                        dragToReorder: 'Drag to reorder',
                        moveUp: 'Move up',
                        moveDown: 'Move down',
                        close: 'Close',
                        blockOnboarding: 'Onboarding',
                        blockGlance: 'At a glance',
                        blockTraffic: 'Traffic & performance',
                        blockSeo: 'SEO health',
                        blockOrders: 'Pending orders',
                    },
                },
            },
        },
    }),
}))

import { CustomizeModal } from '@/components/dashboard/revamp/customize-modal'
import { DEFAULT_DASHBOARD_BLOCKS } from '@/lib/dashboard-utils'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CustomizeModal — body scroll lock [TC-F03.71]', () => {
    beforeEach(() => {
        document.body.style.overflow = ''
    })

    it('TC-F03.71: opening the modal locks body scroll; closing (Cancel) restores it', async () => {
        // Arrange
        render(<CustomizeModal defaultVisible={DEFAULT_DASHBOARD_BLOCKS} />)
        expect(document.body.style.overflow).toBe('')

        // Act: open
        fireEvent.click(screen.getByTestId('customize-dashboard-btn'))
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument()
        })

        // Assert: background page can no longer scroll behind the modal
        expect(document.body.style.overflow).toBe('hidden')

        // Act: close via Cancel
        fireEvent.click(screen.getByText('Cancel'))
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })

        // Assert: restored
        expect(document.body.style.overflow).toBe('')
    })

    it('TC-F03.71: unmounting the component while the modal is open still restores scroll', async () => {
        // Arrange
        const { unmount } = render(<CustomizeModal defaultVisible={DEFAULT_DASHBOARD_BLOCKS} />)
        fireEvent.click(screen.getByTestId('customize-dashboard-btn'))
        await waitFor(() => {
            expect(document.body.style.overflow).toBe('hidden')
        })

        // Act
        unmount()

        // Assert
        expect(document.body.style.overflow).toBe('')
    })
})
