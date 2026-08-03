import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import enLocale from '@/i18n/locales/en.json'

vi.mock('@/i18n', () => ({
    useI18n: () => ({ t: enLocale }),
}))

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('next/image', () => ({
    default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ''} />,
}))

vi.mock('lucide-react', () => ({
    Loader2: () => null,
    ZoomIn: () => null,
    X: () => null,
    RotateCcw: () => <span data-testid="refund-icon" />,
}))

vi.mock('@/app/(dashboard)/orders/_components/CancelOrderModal', () => ({ CancelOrderModal: () => null }))
vi.mock('@/app/(dashboard)/orders/_components/ShipOrderModal', () => ({ ShipOrderModal: () => null }))
vi.mock('@/app/(dashboard)/orders/_components/ManualPaymentVerificationBlock', () => ({ ManualPaymentVerificationBlock: () => null }))
vi.mock('@/app/(dashboard)/orders/_components/create-label-modal', () => ({ CreateLabelModal: () => null }))

import { OrderProgress } from '@/app/(dashboard)/orders/_components/OrderDetailPanel'

describe('OrderProgress responsive composition [GH-1652]', () => {
    it('keeps the heading and card shell in standalone drawer mode', () => {
        render(<OrderProgress status="pending" />)

        const progress = screen.getByText(enLocale.dashboard.orders.detail.orderProgress)
            .closest('[data-order-progress-mode="standalone"]')
        expect(progress).not.toBeNull()
        expect(progress).toHaveClass('h-[118px]', 'rounded-[16px]', 'border')
    })

    it('removes the nested heading and fixed height in embedded page mode', () => {
        const { container } = render(<OrderProgress status="pending" embedded />)

        const progress = container.querySelector('[data-order-progress-mode="embedded"]')
        expect(progress).not.toBeNull()
        expect(progress).not.toHaveClass('h-[118px]', 'rounded-[16px]', 'border')
        expect(screen.queryByText(enLocale.dashboard.orders.detail.orderProgress)).not.toBeInTheDocument()
        expect(progress?.querySelector('.min-w-\\[520px\\]')).not.toBeNull()
    })

    it('reserves a wider scroll track for the appended refunded step', () => {
        const { container } = render(<OrderProgress status="refunded" embedded />)

        expect(container.querySelector('.min-w-\\[624px\\]')).not.toBeNull()
        expect(screen.getByTestId('refund-icon')).toBeInTheDocument()
    })
})
