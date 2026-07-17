/** Pickup address form behavior — GH-1652, TC-F36.204. */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

vi.mock('@/i18n', async () => {
    const locale = await import('@/i18n/locales/en.json')
    return {
        useI18n: () => ({
            t: locale.default,
            ti: (template: string, values: Record<string, string>) => (
                Object.entries(values).reduce((result, [key, value]) => result.replace(`{${key}}`, value), template)
            ),
        }),
    }
})

import { PickupAddresses } from '@/app/(dashboard)/settings/shipping/pickup-addresses'

const warehouse = {
    id: 'w-1',
    label: 'HQ',
    phone: '60123456789',
    address1: 'No. 12 Jalan Utama',
    address2: 'Level 2',
    city: 'Petaling Jaya',
    state: 'Selangor',
    postcode: '47810',
    country: 'MY',
    isDefault: true,
}

describe('PickupAddresses [TC-F36.204]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn(() => new Promise<Response>(() => {}))
    })

    it('preserves optional address line 2 when editing', () => {
        const onChange = vi.fn()
        render(<PickupAddresses value={[warehouse]} onChange={onChange} />)

        fireEvent.click(screen.getByRole('button', { name: 'Edit pickup address' }))
        expect(screen.getByLabelText(/Address line 2/i)).toHaveValue('Level 2')
        fireEvent.click(screen.getByRole('button', { name: 'Update address' }))

        expect(onChange).toHaveBeenCalledWith([
            expect.objectContaining({ address2: 'Level 2', phone: '60123456789' }),
        ])
    })

    it('shows field errors instead of silently disabling the form action', () => {
        render(<PickupAddresses value={[]} onChange={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Add address' }))

        expect(screen.getAllByText('Required')).toHaveLength(4)
        expect(screen.getByText('Enter a valid Malaysian phone number.')).toBeInTheDocument()
        expect(screen.getByText('Enter a 5-digit postcode.')).toBeInTheDocument()
    })

    it('does not mutate the draft until deletion is confirmed', async () => {
        const onChange = vi.fn()
        render(<PickupAddresses value={[warehouse]} onChange={onChange} active />)

        fireEvent.click(screen.getByRole('button', { name: 'Delete pickup address' }))
        expect(onChange).not.toHaveBeenCalled()
        expect(screen.getByText(/Saving this change will also turn off EasyParcel/i)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

        await waitFor(() => expect(onChange).toHaveBeenCalledWith([]))
    })

    it('promotes a newly selected default instead of keeping the old default', () => {
        const onChange = vi.fn()
        const branch = { ...warehouse, id: 'w-2', label: 'Branch', address2: undefined, isDefault: false }
        render(<PickupAddresses value={[warehouse, branch]} onChange={onChange} />)

        fireEvent.click(screen.getAllByRole('button', { name: 'Edit pickup address' })[1])
        const defaultControls = screen.getAllByRole('checkbox', { name: /Set as default pickup address/i })
        fireEvent.click(defaultControls[defaultControls.length - 1])
        fireEvent.click(screen.getByRole('button', { name: 'Update address' }))

        const next = onChange.mock.calls[0][0]
        expect(next.map((item: typeof warehouse) => item.id)).toEqual(['w-2', 'w-1'])
        expect(next.map((item: typeof warehouse) => item.isDefault)).toEqual([true, false])
    })
})
