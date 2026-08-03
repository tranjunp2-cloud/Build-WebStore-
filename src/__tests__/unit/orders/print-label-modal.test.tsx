// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import en from '@/i18n/locales/en.json'

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: en,
    ti: (template: string, vars: Record<string, string | number>) =>
      template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? '')),
  }),
}))

import { PrintLabelModal } from '@/app/(dashboard)/orders/_components/detail/print-label-modal'

const pl = en.dashboard.orders.printLabel

describe('[TC-F36.OD.009] Print label format selector accessibility', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:a6-label'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      const isA6 = url.includes('format=A6')

      return {
        ok: isA6,
        headers: {
          get: () => (isA6 ? 'application/pdf' : 'application/json'),
        },
        blob: async () => new Blob(['label'], { type: 'application/pdf' }),
      } as Response
    })
  })

  afterEach(() => {
    cleanup()
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders a native single-select radio group with the unavailable reason', async () => {
    // Arrange
    render(
      <PrintLabelModal
        orderId="order-1685"
        awbNo="AWB-1685"
        labelUrl={null}
        onClose={vi.fn()}
      />,
    )

    // Act
    const group = screen.getByRole('radiogroup', { name: pl.formatLabel })
    await waitFor(() =>
      expect(within(group).getByRole('radio', { name: pl.formatA6 })).toBeEnabled(),
    )
    await waitFor(() =>
      expect(within(group).getByRole('radio', { name: pl.formatA4 }))
        .toHaveAttribute('aria-describedby'),
    )

    // Assert
    const radios = within(group).getAllByRole('radio')
    const a6 = within(group).getByRole('radio', { name: pl.formatA6 })
    const a4 = within(group).getByRole('radio', { name: pl.formatA4 })
    const unavailableDescriptionId = a4.getAttribute('aria-describedby')
    expect(radios).toHaveLength(2)
    expect(a6).toHaveAttribute('type', 'radio')
    expect(a4).toHaveAttribute('type', 'radio')
    expect(a6).toBeChecked()
    expect(a4).toBeDisabled()
    expect(a4).toHaveAttribute('name', a6.getAttribute('name'))
    expect(unavailableDescriptionId).toBeTruthy()
    expect(document.getElementById(unavailableDescriptionId!)).toHaveTextContent(pl.formatUnavailable)
  })

  it('has no dangling tabpanel references or extra focus target in the selector', async () => {
    // Arrange
    const { container } = render(
      <PrintLabelModal
        orderId="order-1685"
        awbNo="AWB-1685"
        labelUrl={null}
        onClose={vi.fn()}
      />,
    )

    // Act
    const group = await screen.findByRole('radiogroup', { name: pl.formatLabel })
    await waitFor(() =>
      expect(within(group).getByRole('radio', { name: pl.formatA4 })).toBeDisabled(),
    )

    // Assert
    expect(group.querySelectorAll('[tabindex="0"]:not([role="radio"])')).toHaveLength(0)
    container.querySelectorAll<HTMLElement>('[aria-controls]').forEach((control) => {
      control.getAttribute('aria-controls')?.split(/\s+/).forEach((id) => {
        expect(document.getElementById(id)).not.toBeNull()
      })
    })
  })

  it('keeps A6 and A4 selectable when both PDF formats are available', async () => {
    // Arrange
    fetchMock.mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'application/pdf',
      },
      blob: async () => new Blob(['label'], { type: 'application/pdf' }),
    } as Response)

    render(
      <PrintLabelModal
        orderId="order-1685"
        awbNo="AWB-1685"
        labelUrl={null}
        onClose={vi.fn()}
      />,
    )

    const group = screen.getByRole('radiogroup', { name: pl.formatLabel })
    await waitFor(() =>
      expect(within(group).getByRole('radio', { name: pl.formatA4 })).toBeEnabled(),
    )
    const a6 = within(group).getByRole('radio', { name: pl.formatA6 })
    const a4 = within(group).getByRole('radio', { name: pl.formatA4 })

    // Act
    fireEvent.click(a4)

    // Assert
    expect(a4).toBeChecked()
    expect(a6).not.toBeChecked()
  })
})
