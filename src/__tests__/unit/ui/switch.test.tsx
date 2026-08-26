import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'

import { Switch } from '@/components/ui/switch'

afterEach(cleanup)

// ── TC-DS1222-02-01 — Fixed size, never stretches in a cell ─────────────────
describe('[TC-DS1222-02-01] Switch has a fixed track size (no stretch in table cell)', () => {
    it('renders with fixed height/width + shrink-0 so flex/table layout cannot grow it', () => {
        // Arrange / Act
        render(<Switch checked={false} />)
        const sw = screen.getByRole('switch')
        // Assert — the exact guard against the original #1222 stretch bug.
        expect(sw).toHaveClass('h-5', 'w-9', 'shrink-0')
    })
})

// ── TC-DS1222-02-02 — Toggling fires onCheckedChange with inverted value ────
describe('[TC-DS1222-02-02] Switch toggles via onCheckedChange', () => {
    it('clicking an off switch requests on (true)', () => {
        const onCheckedChange = vi.fn()
        render(<Switch checked={false} onCheckedChange={onCheckedChange} />)
        fireEvent.click(screen.getByRole('switch'))
        expect(onCheckedChange).toHaveBeenCalledWith(true)
    })

    it('clicking an on switch requests off (false)', () => {
        const onCheckedChange = vi.fn()
        render(<Switch checked onCheckedChange={onCheckedChange} />)
        fireEvent.click(screen.getByRole('switch'))
        expect(onCheckedChange).toHaveBeenCalledWith(false)
    })
})

// ── TC-DS1222-02-03 — aria-checked reflects state ───────────────────────────
describe('[TC-DS1222-02-03] Switch exposes accessible state', () => {
    it('sets role=switch and aria-checked matching the checked prop', () => {
        const { rerender } = render(<Switch checked={false} />)
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
        rerender(<Switch checked />)
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    })
})

// ── TC-DS1222-02-04 — Disabled does not toggle ──────────────────────────────
describe('[TC-DS1222-02-04] Disabled switch does not trigger change', () => {
    it('ignores clicks and shows the not-allowed cursor when disabled', () => {
        const onCheckedChange = vi.fn()
        render(<Switch checked={false} disabled onCheckedChange={onCheckedChange} />)
        const sw = screen.getByRole('switch')
        fireEvent.click(sw)
        expect(onCheckedChange).not.toHaveBeenCalled()
        expect(sw).toHaveClass('cursor-not-allowed')
        expect(sw).toBeDisabled()
    })
})
