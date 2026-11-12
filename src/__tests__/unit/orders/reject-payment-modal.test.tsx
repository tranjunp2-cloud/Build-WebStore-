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
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { RejectPaymentModal } from '@/app/(dashboard)/orders/_components/RejectPaymentModal'

const rp = en.dashboard.orders.rejectPayment

describe('RejectPaymentModal — explicit reason required (#2097)', () => {
  const fetchMock = vi.fn()
  const onSuccess = vi.fn()
  const onClose = vi.fn()

  const renderModal = () =>
    render(<RejectPaymentModal orderId={42} onSuccess={onSuccess} onClose={onClose} />)

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('[TC-F10-06-26] disables Submit and preselects nothing when no reason is chosen', () => {
    // Arrange + Act
    renderModal()
    const submit = screen.getByRole('button', { name: rp.submit })

    // Assert
    expect(submit).toBeDisabled()
    fireEvent.click(submit)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('[TC-F10-06-23] sends image_blurry without detail after choosing "blurry"', async () => {
    // Arrange
    renderModal()

    // Act
    fireEvent.click(screen.getByRole('button', { name: rp.reasons.imageBlurry }))
    const submit = screen.getByRole('button', { name: rp.submit })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    // Assert
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/orders/42/reject-payment')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ reason: 'image_blurry' })
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it('[TC-F10-06-24] sends reason other with detail when detail >= 10 chars', async () => {
    // Arrange
    renderModal()

    // Act
    fireEvent.click(screen.getByRole('button', { name: rp.reasons.other }))
    fireEvent.change(screen.getByPlaceholderText(rp.detailPlaceholder), {
      target: { value: 'A'.repeat(15) },
    })
    fireEvent.click(screen.getByRole('button', { name: rp.submit }))

    // Assert
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      reason: 'other',
      detail: 'A'.repeat(15),
    })
  })

  it('[TC-F10-06-25] blocks "other" with detail < 10 chars and shows detailError', () => {
    // Arrange
    renderModal()

    // Act
    fireEvent.click(screen.getByRole('button', { name: rp.reasons.other }))
    fireEvent.change(screen.getByPlaceholderText(rp.detailPlaceholder), {
      target: { value: 'short' },
    })
    fireEvent.click(screen.getByRole('button', { name: rp.submit }))

    // Assert
    expect(screen.getByText(rp.detailError)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
