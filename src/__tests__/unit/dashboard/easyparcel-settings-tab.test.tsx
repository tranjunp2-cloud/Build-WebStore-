/**
 * EasyParcel settings draft/save behavior — GH-1652.
 * Covers TC-F36.203: local edits are explicit-save only and survive failed saves.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/i18n', async () => {
    const locale = await import('@/i18n/locales/en.json')
    return { useI18n: () => ({ t: locale.default }) }
})

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/app/(dashboard)/settings/shipping/pickup-addresses', () => ({
    PickupAddresses: ({ value, onChange }: { value: Array<Record<string, unknown>>; onChange: (next: Array<Record<string, unknown>>) => void }) => (
        <button
            type="button"
            onClick={() => onChange([{ ...value[0], phone: '013-456 7890' }])}
        >
            Edit pickup draft
        </button>
    ),
}))

vi.mock('@/app/(dashboard)/settings/shipping/ep-wallet-banner', () => ({
    EpWalletBanner: () => null,
}))

vi.mock('@/components/ui/confirm-modal', () => ({
    ConfirmModal: () => null,
}))

vi.mock('@/app/(dashboard)/settings/shipping/ep-setup-stepper', () => ({
    EpSetupStepper: () => null,
}))

import { EasyParcelSettingsTab } from '@/app/(dashboard)/settings/shipping/easyparcel-settings-tab'

const initialEpConfig = {
    enabled: true,
    testedAt: '2026-07-17T00:00:00.000Z',
    warehouses: [{
        id: 'w-1',
        label: 'HQ',
        phone: '60123456789',
        address1: 'No. 12 Jalan Utama',
        city: 'Petaling Jaya',
        state: 'Selangor',
        postcode: '47810',
        country: 'MY',
        isDefault: true,
    }],
}

describe('EasyParcelSettingsTab [TC-F36.203]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn()
    })

    it('keeps edits local until Save Settings is clicked', async () => {
        render(<EasyParcelSettingsTab tenantId="tenant-1" initialEpConfig={initialEpConfig} />)

        fireEvent.click(screen.getByRole('button', { name: 'Edit pickup draft' }))

        expect(global.fetch).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument()
    })

    it('keeps the dirty draft after a failed save', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: false,
            json: async () => ({ success: false, error: { message: 'Save rejected' } }),
        } as Response)
        render(<EasyParcelSettingsTab tenantId="tenant-1" initialEpConfig={initialEpConfig} />)

        fireEvent.click(screen.getByRole('button', { name: 'Edit pickup draft' }))
        fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
        expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument()
    })

    it('sends canonical data and clears dirty state after a successful save', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    enabled: true,
                    warehouses: [{ ...initialEpConfig.warehouses[0], phone: '60134567890' }],
                },
            }),
        } as Response)
        render(<EasyParcelSettingsTab tenantId="tenant-1" initialEpConfig={initialEpConfig} />)

        fireEvent.click(screen.getByRole('button', { name: 'Edit pickup draft' }))
        fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/tenant/tenant-1/easyparcel-save',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('60134567890'),
                }),
            )
        })
        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Save Settings' })).not.toBeInTheDocument()
        })
    })
})
