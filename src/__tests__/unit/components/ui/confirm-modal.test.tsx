/**
 * GH-1290 Bug 5 — Shared ConfirmModal (src/components/ui/confirm-modal.tsx)
 * TC-IDs: TC-GH1290-CM-01 → TC-GH1290-CM-08
 *
 * Replaces the per-page hand-built delete popups. Verifies a11y title/description,
 * confirm/cancel wiring, conditional render, and the loading (disabled) state.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmModal } from '@/components/ui/confirm-modal'

function setup(overrides = {}) {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const props = {
        open: true,
        onConfirm,
        onCancel,
        title: 'Delete customer',
        description: 'Are you sure you want to delete Jane Doe?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        ...overrides,
    }
    render(<ConfirmModal {...props} />)
    return { onConfirm, onCancel }
}

describe('TC-GH1290-CM-01: renders title, description and labels when open', () => {
    it('shows title + description + both buttons', () => {
        setup()
        expect(screen.getByText('Delete customer')).toBeTruthy()
        expect(screen.getByText(/Are you sure you want to delete Jane Doe/i)).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    })
})

describe('TC-GH1290-CM-02: not rendered when open=false', () => {
    it('renders nothing', () => {
        setup({ open: false })
        expect(screen.queryByText('Delete customer')).toBeNull()
    })
})

describe('TC-GH1290-CM-03: confirm click fires onConfirm', () => {
    it('calls onConfirm once', () => {
        const { onConfirm } = setup()
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })
})

describe('TC-GH1290-CM-04: cancel click fires onCancel', () => {
    it('calls onCancel once', () => {
        const { onCancel } = setup()
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(onCancel).toHaveBeenCalledTimes(1)
    })
})

describe('TC-GH1290-CM-05: loading disables both buttons', () => {
    it('disables confirm + cancel and blocks clicks', () => {
        const { onConfirm, onCancel } = setup({ loading: true })
        const confirm = screen.getByRole('button', { name: 'Delete' })
        const cancel = screen.getByRole('button', { name: 'Cancel' })
        expect((confirm as HTMLButtonElement).disabled).toBe(true)
        expect((cancel as HTMLButtonElement).disabled).toBe(true)
        fireEvent.click(confirm)
        expect(onConfirm).not.toHaveBeenCalled()
    })
})

describe('TC-GH1290-CM-06: description optional', () => {
    it('renders without description', () => {
        setup({ description: undefined })
        expect(screen.getByText('Delete customer')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
    })
})

describe('TC-GH1290-CM-07: hideCancel (GH-1458 publish-gate alert modal)', () => {
    it('renders only the confirm button when hideCancel is true', () => {
        setup({ hideCancel: true, cancelLabel: undefined })
        expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
        expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    })

    it('still renders both buttons when hideCancel is omitted (default false)', () => {
        setup()
        expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    })
})

describe('TC-GH1290-CM-08: a description with a list renders as valid HTML (no list inside a <p>)', () => {
    it('wraps the description in a <div> that still describes the dialog', () => {
        setup({ description: <span><span>Check these fields:</span><ul><li>Price</li></ul></span> })
        const list = screen.getByRole('list')
        expect(list.closest('p')).toBeNull()
        const dialog = screen.getByRole('dialog')
        const described = document.getElementById(dialog.getAttribute('aria-describedby') ?? '')
        expect(described?.tagName).toBe('DIV')
        expect(described?.contains(list)).toBe(true)
    })
})
