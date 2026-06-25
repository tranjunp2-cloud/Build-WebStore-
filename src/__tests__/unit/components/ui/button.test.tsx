/**
 * GH-1290 Bug 1 — Shared Button (src/components/ui/button.tsx)
 * TC-IDs: TC-GH1290-BTN-01 → TC-GH1290-BTN-05
 *
 * The dashboard standardizes on this one Button. Verifies variant/size classes,
 * click + disabled behaviour, and asChild slot composition.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('TC-GH1290-BTN-01: renders children and fires onClick', () => {
    it('calls onClick once', () => {
        const onClick = vi.fn()
        render(<Button onClick={onClick}>Save</Button>)
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))
        expect(onClick).toHaveBeenCalledTimes(1)
    })
})

describe('TC-GH1290-BTN-02: disabled blocks clicks', () => {
    it('does not fire onClick when disabled', () => {
        const onClick = vi.fn()
        render(<Button disabled onClick={onClick}>Save</Button>)
        const btn = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
        expect(btn.disabled).toBe(true)
        fireEvent.click(btn)
        expect(onClick).not.toHaveBeenCalled()
    })
})

describe('TC-GH1290-BTN-03: dashPrimary variant applies gradient class', () => {
    it('includes the dashPrimary gradient', () => {
        render(<Button variant="dashPrimary">Go</Button>)
        const btn = screen.getByRole('button', { name: 'Go' })
        expect(btn.className).toContain('linear-gradient')
    })
})

describe('TC-GH1290-BTN-04: dash size applies h-9 (36px)', () => {
    it('includes the dash size height token', () => {
        render(<Button size="dash">Go</Button>)
        // Design-system unification (PR #1400): dash size moved from the literal
        // h-[36px] to the h-9 scale token (same 36px) so all sizes share one height scale.
        expect(screen.getByRole('button', { name: 'Go' }).className).toContain('h-9')
    })
})

describe('TC-GH1290-BTN-05: asChild renders the child element', () => {
    it('renders an anchor instead of a button', () => {
        render(
            <Button asChild>
                {/* external href: tránh next/no-html-link-for-pages (rule chỉ chặn path nội bộ) */}
                <a href="https://example.com">Link</a>
            </Button>,
        )
        const link = screen.getByRole('link', { name: 'Link' })
        expect(link.tagName).toBe('A')
        // variant classes still applied to the slotted element
        expect(link.className).toContain('inline-flex')
    })
})
