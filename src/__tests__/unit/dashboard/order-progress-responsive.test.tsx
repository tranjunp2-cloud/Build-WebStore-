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
    Check: () => <span data-testid="order-progress-check-icon" />,
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

describe('[TC-F10-01-13][GH-1695 AC-1/AC-2/AC-3/AC-4] OrderProgress step states', () => {
    it('distinguishes completed, current, and upcoming nodes at Ready to Ship', () => {
        const { container } = render(<OrderProgress status="ready_to_ship" embedded />)

        const states = Array.from(container.querySelectorAll('[data-order-step-state]'))
            .map(node => node.getAttribute('data-order-step-state'))
        const icons = Array.from(container.querySelectorAll('[data-order-step-icon]'))
        const labels = Array.from(container.querySelectorAll('[data-order-step-label]'))
        const connectors = Array.from(container.querySelectorAll('[data-order-step-connector]'))

        expect(states).toEqual(['completed', 'completed', 'current', 'upcoming', 'upcoming'])
        expect(screen.getAllByTestId('order-progress-check-icon')).toHaveLength(2)
        expect(icons).toHaveLength(5)
        expect(icons.every(icon => (
            icon.classList.contains('h-8') &&
            icon.classList.contains('w-8') &&
            icon.classList.contains('md:h-9') &&
            icon.classList.contains('md:w-9')
        ))).toBe(true)
        expect(icons[0]).not.toHaveClass('shadow-[0_0_0_4px_hsl(var(--primary)/0.2)]')
        expect(icons[1]).not.toHaveClass('shadow-[0_0_0_4px_hsl(var(--primary)/0.2)]')
        expect(icons[2]).toHaveClass('shadow-[0_0_0_4px_hsl(var(--primary)/0.2)]')
        expect(labels.slice(0, 3).every(label => (
            label.classList.contains('font-semibold') &&
            label.classList.contains('text-dash-text') &&
            !label.classList.contains('text-dash-text-muted')
        ))).toBe(true)
        expect(labels.slice(3).every(label => (
            label.classList.contains('font-normal') &&
            label.classList.contains('text-dash-text-muted')
        ))).toBe(true)
        expect(connectors).toHaveLength(4)
        expect(connectors.map(connector => (connector as HTMLElement).style.background)).toEqual([
            'hsl(var(--success))',
            'hsl(var(--success))',
            'var(--dash-border)',
            'var(--dash-border)',
        ])
        expect(connectors.every(connector => (
            connector.classList.contains('mt-[15px]') &&
            connector.classList.contains('md:mt-[17px]')
        ))).toBe(true)
    })

    it('keeps Pending current without rendering a completed checkmark', () => {
        const { container } = render(<OrderProgress status="pending" embedded />)

        const states = Array.from(container.querySelectorAll('[data-order-step-state]'))
            .map(node => node.getAttribute('data-order-step-state'))
        const canvas = container.querySelector('[data-order-stepper-canvas]')

        expect(states).toEqual(['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
        expect(screen.queryByTestId('order-progress-check-icon')).not.toBeInTheDocument()
        expect(canvas).toHaveClass('pt-1')
    })

    it('marks all standard nodes completed and the appended Refunded node current', () => {
        const { container } = render(<OrderProgress status="refunded" embedded />)

        const states = Array.from(container.querySelectorAll('[data-order-step-state]'))
            .map(node => node.getAttribute('data-order-step-state'))

        expect(states).toEqual(['completed', 'completed', 'completed', 'completed', 'completed', 'current'])
        expect(screen.getAllByTestId('order-progress-check-icon')).toHaveLength(5)
        expect(screen.getByTestId('refund-icon')).toBeInTheDocument()
    })
})
