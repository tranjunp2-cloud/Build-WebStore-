/**
 * EasyParcel Setup Stepper Tests — F36 Phase 04 [GH-1333]
 * Tests the guided setup flow shown after OAuth but before activation:
 * - Step 1 (Pickup): warehouse list, "Next" enabled when ≥1 warehouse
 * - Step 2 (Courier): courier picker, "Next" enabled when courier selected
 * - Step 3 (Review): shows summary, "Save & Activate" disabled until ready
 * - Activation: PATCH /api/tenants/{tenantId} with enabled=true + warehouses + courier
 *
 * TC-F36.3x references from docs/qa/F36-easyparcel.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import React from 'react'
import { EpSetupStepper } from '@/app/(dashboard)/settings/shipping/ep-setup-stepper'

// ─── Top-level mocks ────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('@/i18n', async () => {
    const locale = await import('@/i18n/locales/en.json')
    return { useI18n: () => ({ t: locale.default }) }
})

vi.mock('@/app/(dashboard)/settings/shipping/pickup-addresses', () => ({
    PickupAddresses: ({ value, onChange, onEditingChange }: { value: any[]; onChange: (v: any[]) => void; onEditingChange?: (editing: boolean) => void }) => (
        <div data-testid="pickup-addresses">
            <button
                data-testid="add-warehouse"
                onClick={() => {
                    onChange([
                        ...value,
                        { id: 'w-' + Date.now(), label: 'New Warehouse', phone: '0123456789', address1: 'St', city: 'Petaling Jaya', state: 'Selangor', postcode: '47810' },
                    ])
                    onEditingChange?.(false)
                }}
            >
                Add Warehouse
            </button>
            <div data-testid="warehouse-count">{value.length} warehouse(s)</div>
            {value.map((w: any) => (
                <div key={w.id} data-testid={`warehouse-${w.id}`}>
                    {w.label}
                </div>
            ))}
        </div>
    ),
}))

vi.mock('@/app/(dashboard)/settings/shipping/ep-wallet-banner', () => ({
    EpWalletBanner: ({ tenantId, active }: { tenantId: string; active?: boolean }) => (
        <div data-testid="ep-wallet-banner">
            EasyParcel Wallet Info (tenantId={tenantId}, active={active ? 'true' : 'false'})
        </div>
    ),
}))

// Mock fetch globally
global.fetch = vi.fn()

// ─── Test fixtures ────────────────────────────────────────────────────────

const completeWarehouse = {
    id: 'w-1',
    label: 'HQ Warehouse',
    phone: '0123456789',
    address1: 'No.12 Jalan Merdeka',
    city: 'Kuala Lumpur',
    state: 'Selangor',
    postcode: '47810',
    country: 'MY',
    isDefault: true,
}

// ─── Stepper Component Tests ───────────────────────────────────────────────

describe('EpSetupStepper [TC-F36.30..F36.39]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn()
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.30: Initial render — Step 1 (Pickup) shown on mount with Next disabled
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.30] Renders Step 1 (Pickup) on mount with Next button disabled (no warehouses)', () => {
        // Arrange
        render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{
                    accessToken: 'token',
                    warehouses: [], // No warehouses initially
                    enabled: false,
                }}
            />,
        )

        // Assert
        expect(screen.getByText('Pickup')).toBeInTheDocument()
        const nextButton = screen.getByRole('button', { name: /next/i })
        expect(nextButton).toBeDisabled() // Can't proceed without warehouse
    })

    it('offers manual EasyParcel sync when connected without a warehouse', async () => {
        const onSyncFromEp = vi.fn().mockResolvedValue(undefined)
        render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{ accessToken: 'token', warehouses: [], enabled: false }}
                onSyncFromEp={onSyncFromEp}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: /sync from easyparcel/i }))
        expect(onSyncFromEp).not.toHaveBeenCalled()

        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: /^sync$/i }))

        await waitFor(() => expect(onSyncFromEp).toHaveBeenCalledTimes(1))
    })

    it('renders continuous mobile connectors and flexible desktop connectors between every step', () => {
        const { container } = render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{ accessToken: 'token', warehouses: [], enabled: false }}
            />,
        )

        const mobileConnectors = container.querySelectorAll('[data-step-connector-mobile]')
        const desktopConnectors = container.querySelectorAll('[data-step-connector-desktop]')
        expect(mobileConnectors).toHaveLength(2)
        expect(desktopConnectors).toHaveLength(2)
        expect(mobileConnectors[0]).toHaveClass('sm:hidden')
        expect(desktopConnectors[0]).toHaveClass('flex-1', 'sm:block')
        expect(screen.getByText('Pickup').parentElement).toHaveAttribute('aria-current', 'step')
    })

    it('uses fill-only step indicators and dashboard-standard navigation button height', () => {
        const { container } = render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{ accessToken: 'token', warehouses: [], enabled: false }}
            />,
        )

        const stepNodes = container.querySelectorAll('[data-step-state]')
        expect(stepNodes).toHaveLength(3)
        stepNodes.forEach((node) => {
            expect(node).not.toHaveClass('border-2')
            expect(node).not.toHaveClass('border-solid')
        })
        expect(container.querySelector('[data-step-state="current"]')).toHaveClass('bg-[hsl(var(--primary)/0.14)]')
        expect(screen.getByRole('button', { name: /back/i })).not.toHaveClass('h-11')
        expect(screen.getByRole('button', { name: /next/i })).not.toHaveClass('h-11')
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.31: Step 1 Next button enabled when ≥1 warehouse added
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.31] Step 1 Next button enabled after adding ≥1 warehouse', async () => {
        // Arrange
        render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{
                    accessToken: 'token',
                    warehouses: [],
                    enabled: false,
                }}
            />,
        )

        const addButton = screen.getByTestId('add-warehouse')

        // Act: Add a warehouse
        fireEvent.click(addButton)

        // Assert
        await waitFor(() => {
            const nextButton = screen.getByRole('button', { name: /next/i })
            expect(nextButton).not.toBeDisabled()
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.32: Clicking Next on Step 1 → proceeds to Step 2 (Review)
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.32] Clicking Next on Step 1 advances to Step 2 (Review)', async () => {
        // Arrange
        render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{
                    accessToken: 'token',
                    warehouses: [completeWarehouse],
                    enabled: false,
                }}
            />,
        )

        // Act
        const nextButton = screen.getByRole('button', { name: /next/i })
        fireEvent.click(nextButton)

        // Assert: Should show Review step (no Courier step in new flow)
        await waitFor(() => {
            expect(screen.getByText(/Review.*activate/i)).toBeInTheDocument()
            expect(screen.getByTestId('ep-wallet-banner')).toBeInTheDocument()
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.33: Step 2 (Review) shows warehouse summary (no courier UI)
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.33] Step 2 Review displays warehouse label + address', async () => {
        // Arrange
        render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{
                    accessToken: 'token',
                    warehouses: [completeWarehouse],
                    enabled: false,
                }}
            />,
        )

        // Navigate to Step 2 (Review)
        const nextButton = screen.getByRole('button', { name: /next/i })
        fireEvent.click(nextButton)

        // Assert: Should show Review step with warehouse summary, NO courier selection UI
        await waitFor(() => {
            expect(screen.getByText(/Review.*activate/i)).toBeInTheDocument()
        })

        // These should be in the Review step
        expect(screen.getByText('HQ Warehouse')).toBeInTheDocument() // Warehouse label
        expect(screen.getByTestId('ep-wallet-banner')).toBeInTheDocument()
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.37: Save & Activate button enabled when warehouse selected (no courier check)
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.37] Save & Activate button only enabled when warehouse selected', async () => {
        render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{
                    accessToken: 'token',
                    warehouses: [],
                    enabled: false,
                }}
            />,
        )

        // Act: Add warehouse and advance to Step 2
        const addButton = screen.getByTestId('add-warehouse')
        fireEvent.click(addButton)

        const nextButton = screen.getByRole('button', { name: /next/i })
        await waitFor(() => expect(nextButton).toBeEnabled())
        fireEvent.click(nextButton)

        const activateButton = await screen.findByRole('button', { name: /save (?:&|and) activate/i })
        expect(activateButton).toBeEnabled()
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.38: Clicking Save & Activate posts easyparcel-save with warehouses (NO courier)
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.38] Clicking Save & Activate POSTs easyparcel-save with warehouses only', async () => {
        // Arrange
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        })
        global.fetch = mockFetch

        // Mock window.location.reload
        delete (window as any).location
        window.location = { reload: vi.fn() } as any

        render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{
                    accessToken: 'token',
                    warehouses: [completeWarehouse],
                    enabled: false,
                }}
            />,
        )

        // Navigate to Step 2 (Review)
        const nextButton = screen.getByRole('button', { name: /next/i })
        fireEvent.click(nextButton)

        // Act: Click Save & Activate
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /save (?:&|and) activate/i })).toBeInTheDocument()
        })

        const activateButton = screen.getByRole('button', { name: /save (?:&|and) activate/i })
        fireEvent.click(activateButton)

        // Assert: POST body should have warehouses ONLY, NO selectedCourier
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                '/api/tenant/tenant-1/easyparcel-save',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        enabled: true,
                        warehouses: [{ ...completeWarehouse, phone: '60123456789' }],
                    }),
                }),
            )
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.39: Save & Activate success shows toast + reloads page
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.39] Save & Activate success shows toast and reloads page', async () => {
        // Arrange
        const { toast } = await import('sonner')
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        })
        global.fetch = mockFetch

        const mockReload = vi.fn()
        delete (window as any).location
        window.location = { reload: mockReload } as any

        render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{
                    accessToken: 'token',
                    warehouses: [completeWarehouse],
                    enabled: false,
                }}
            />,
        )

        // Navigate to Step 2
        const nextButton = screen.getByRole('button', { name: /next/i })
        fireEvent.click(nextButton)

        // Act: Click Save & Activate
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /save (?:&|and) activate/i })).toBeInTheDocument()
        })

        const activateButton = screen.getByRole('button', { name: /save (?:&|and) activate/i })
        fireEvent.click(activateButton)

        // Assert
        await waitFor(() => {
            expect(vi.mocked(toast).success).toHaveBeenCalledWith('EasyParcel activated')
            expect(mockReload).toHaveBeenCalled()
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.40: Save & Activate error shows error toast + doesn't reload
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.40] Save & Activate uses localized fallback and does NOT reload', async () => {
        // Arrange
        const { toast } = await import('sonner')
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ error: { message: 'Failed to activate' } }),
        })
        global.fetch = mockFetch

        const mockReload = vi.fn()
        delete (window as any).location
        window.location = { reload: mockReload } as any

        render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{
                    accessToken: 'token',
                    warehouses: [completeWarehouse],
                    enabled: false,
                }}
            />,
        )

        // Navigate to Step 2
        const nextButton = screen.getByRole('button', { name: /next/i })
        fireEvent.click(nextButton)

        // Act: Click Save & Activate
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /save (?:&|and) activate/i })).toBeInTheDocument()
        })

        const activateButton = screen.getByRole('button', { name: /save (?:&|and) activate/i })
        fireEvent.click(activateButton)

        // Assert
        await waitFor(() => {
            expect(vi.mocked(toast).error).toHaveBeenCalledWith('Failed to save EasyParcel settings')
            expect(mockReload).not.toHaveBeenCalled()
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.41: Back from Pickup (step 1) returns to Connect (step 0)
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.41] Back from Step 1 goes to Connect step (Back then disabled)', () => {
        // Arrange
        render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{
                    accessToken: 'token',
                    warehouses: [completeWarehouse],
                    enabled: false,
                }}
            />,
        )

        // Act: on Step 1 (Pickup), Back is enabled → go to Connect (step 0)
        const backButton = screen.getByRole('button', { name: /back/i })
        expect(backButton).not.toBeDisabled()
        fireEvent.click(backButton)

        // Assert: Connect step shows account + Reconnect/Disconnect; Back now disabled
        expect(screen.getByText(/OAuth session active/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /reconnect/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /back/i })).toBeDisabled()
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.42: Back button works on Step 2, returns to Step 1
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.42] Back button works on Step 2 (Review), returns to Step 1', async () => {
        // Arrange
        render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{
                    accessToken: 'token',
                    warehouses: [completeWarehouse],
                    enabled: false,
                }}
            />,
        )

        // Navigate to Step 2 (Review)
        const nextButton = screen.getByRole('button', { name: /next/i })
        fireEvent.click(nextButton)

        await waitFor(() => {
            expect(screen.getByText(/Review.*activate/i)).toBeInTheDocument()
        })

        // Act: Click Back
        const backButton = screen.getByRole('button', { name: /back/i })
        expect(backButton).not.toBeDisabled()
        fireEvent.click(backButton)

        // Assert: Back to Step 1 (Pickup)
        await waitFor(() => {
            expect(screen.getByTestId('pickup-addresses')).toBeInTheDocument()
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.43: Step indicator shows completed steps with checkmark
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.43] Completed steps show checkmark in step indicator', async () => {
        // Arrange
        render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{
                    accessToken: 'token',
                    warehouses: [completeWarehouse],
                    enabled: false,
                }}
            />,
        )

        // Navigate to Step 2 (Review)
        const nextButton = screen.getByRole('button', { name: /next/i })
        fireEvent.click(nextButton)

        // Assert: Should be on Step 2 (Review) now, step 1 (Pickup) shows checkmark
        await waitFor(() => {
            expect(screen.getByText(/Review.*activate/i)).toBeInTheDocument()
        })
        for (const icon of screen.getAllByTestId('easyparcel-step-complete-icon')) {
            expect(icon).toHaveClass('!text-white')
        }
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.44: Save & Activate button only enabled when warehouse selected
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.44] Save & Activate button only enabled after warehouse selected', async () => {
        // Arrange: Start with warehouse configured
        render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{
                    accessToken: 'token',
                    warehouses: [completeWarehouse],
                    enabled: false,
                }}
            />,
        )

        // Navigate to Step 2 (Review)
        const nextButton = screen.getByRole('button', { name: /next/i })
        fireEvent.click(nextButton)

        // Assert: Activate button should exist and be enabled (canActivate=true)
        await waitFor(() => {
            const activateBtn = screen.getByRole('button', { name: /save (?:&|and) activate/i })
            expect(activateBtn).not.toBeDisabled()
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.45: Initial config with warehouse pre-populates stepper
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.45] Initial config with warehouse pre-populates state', async () => {
        // Arrange
        render(
            <EpSetupStepper
                tenantId="tenant-1"
                initialEpConfig={{
                    accessToken: 'token',
                    warehouses: [completeWarehouse],
                    enabled: false,
                }}
            />,
        )

        // Assert: Warehouse count should be 1
        expect(screen.getByTestId('warehouse-count')).toHaveTextContent('1 warehouse(s)')

        // Navigate to Step 2 and verify Review shows warehouse
        const nextButton = screen.getByRole('button', { name: /next/i })
        fireEvent.click(nextButton)

        // In Step 2 (Review), should show warehouse summary
        await waitFor(() => {
            expect(screen.getByText('HQ Warehouse')).toBeInTheDocument()
        })
    })
})
