import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

import { Badge, badgeVariants } from '@/components/ui/badge'

afterEach(cleanup)

const VARIANTS = ['default', 'secondary', 'destructive', 'outline', 'success', 'warning'] as const

// ── TC-DS1222-03-01 — All 6 variants render ─────────────────────────────────
describe('[TC-DS1222-03-01] Badge renders all 6 variants', () => {
    it.each(VARIANTS)('renders the "%s" variant with its label', (variant) => {
        render(<Badge variant={variant}>{variant}-label</Badge>)
        expect(screen.getByText(`${variant}-label`)).toBeInTheDocument()
    })

    it('produces a distinct class string per variant', () => {
        const classes = VARIANTS.map((v) => badgeVariants({ variant: v }))
        // No two variants collapse to the same class output.
        expect(new Set(classes).size).toBe(VARIANTS.length)
    })
})

// ── TC-DS1222-03-02 — border-solid explicit (preflight off) ─────────────────
describe('[TC-DS1222-03-02] Badge keeps border-solid so outline actually paints', () => {
    it('base class string includes border + border-solid', () => {
        const base = badgeVariants({ variant: 'outline' })
        expect(base).toContain('border')
        expect(base).toContain('border-solid')
    })
})

// ── TC-DS1222-03-03 — Dot indicator ─────────────────────────────────────────
describe('[TC-DS1222-03-03] Badge dot indicator', () => {
    it('renders a leading rounded dot when dot is set', () => {
        const { container } = render(<Badge dot>Active</Badge>)
        const dot = container.querySelector('span[aria-hidden]')
        expect(dot).not.toBeNull()
        expect(dot).toHaveClass('rounded-full')
    })

    it('omits the dot when dot is not set', () => {
        const { container } = render(<Badge>Active</Badge>)
        expect(container.querySelector('span[aria-hidden]')).toBeNull()
    })
})
