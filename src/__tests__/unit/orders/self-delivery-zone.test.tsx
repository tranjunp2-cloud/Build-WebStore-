// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import en from '@/i18n/locales/en.json'

vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: en }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { SelfDeliveryZone } from '@/app/(dashboard)/orders/_components/detail/self-delivery-zone'

describe('SelfDeliveryZone', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('accepts and submits a courier that is not in the predefined list', async () => {
    const onUpdate = vi.fn()
    render(
      <SelfDeliveryZone
        orderId="order-custom-courier"
        selfDeliveryCourier={null}
        trackingNumber={null}
        onUpdate={onUpdate}
      />,
    )

    const submit = screen.getByRole('button', { name: en.dashboard.orders.selfDelivery.shipOrder })
    expect(screen.queryByLabelText(en.dashboard.orders.selfDelivery.customCourierLabel)).not.toBeInTheDocument()
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText(en.dashboard.orders.selfDelivery.courierLabel), {
      target: { value: '__other__' },
    })
    fireEvent.change(screen.getByLabelText(en.dashboard.orders.selfDelivery.customCourierLabel), {
      target: { value: 'Lalamove Malaysia' },
    })
    fireEvent.change(screen.getByLabelText(en.dashboard.orders.selfDelivery.trackingLabel), {
      target: { value: 'LLM-123456' },
    })
    expect(submit).toBeEnabled()

    fireEvent.click(submit)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/orders/order-custom-courier/self-deliver',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            courier: 'Lalamove Malaysia',
            trackingNumber: 'LLM-123456',
          }),
        }),
      )
    })
    expect(onUpdate).toHaveBeenCalledOnce()
  })
})
