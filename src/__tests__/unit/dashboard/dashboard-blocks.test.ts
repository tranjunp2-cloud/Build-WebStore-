/**
 * F03 single-column revamp — dashboard block model + preference migration.
 * Covers normalizeDashboardBlocks (runtime migration, no DB change) + buildCustomizeRows.
 * TC-F03 (block model — single-column revamp).
 */
import { describe, it, expect } from 'vitest'
import {
    normalizeDashboardBlocks,
    buildCustomizeRows,
    DEFAULT_DASHBOARD_BLOCKS,
    ALL_BLOCKS,
} from '@/lib/dashboard-utils'

describe('normalizeDashboardBlocks', () => {
    it('returns defaults for null/empty input', () => {
        expect(normalizeDashboardBlocks(null)).toEqual(DEFAULT_DASHBOARD_BLOCKS)
        expect(normalizeDashboardBlocks(undefined)).toEqual(DEFAULT_DASHBOARD_BLOCKS)
        expect(normalizeDashboardBlocks([])).toEqual(DEFAULT_DASHBOARD_BLOCKS)
    })

    it('resets legacy stat-level prefs to defaults (granularity changed)', () => {
        expect(normalizeDashboardBlocks(['views', 'leads', 'engagement'])).toEqual(DEFAULT_DASHBOARD_BLOCKS)
        expect(normalizeDashboardBlocks(['revenue'])).toEqual(DEFAULT_DASHBOARD_BLOCKS)
    })

    it('keeps valid block ids in saved order', () => {
        expect(normalizeDashboardBlocks(['seo', 'glance', 'traffic'])).toEqual(['seo', 'glance', 'traffic'])
    })

    it('drops unknown ids and de-duplicates (first wins)', () => {
        expect(normalizeDashboardBlocks(['glance', 'bogus', 'glance', 'seo'])).toEqual(['glance', 'seo'])
    })

    it('supports hiding blocks (omitted ids stay hidden)', () => {
        expect(normalizeDashboardBlocks(['glance'])).toEqual(['glance'])
    })

    it('allows enabling the off-by-default orders block', () => {
        expect(normalizeDashboardBlocks(['glance', 'orders'])).toEqual(['glance', 'orders'])
    })
})

describe('buildCustomizeRows', () => {
    it('anchors hidden blocks at their schema position (not appended at the end)', () => {
        // glance + seo visible; the rest hidden but kept at their canonical ALL_BLOCKS slots
        const rows = buildCustomizeRows(['glance', 'seo'])
        expect(rows.map(r => r.id)).toEqual(['onboarding', 'glance', 'traffic', 'seo', 'tools', 'orders'])
        expect(rows.filter(r => r.visible).map(r => r.id)).toEqual(['glance', 'seo'])
        // every block represented exactly once
        expect(rows).toHaveLength(ALL_BLOCKS.length)
    })

    it('keeps a toggled-off block in place across rebuild (no jump to bottom)', () => {
        // traffic hidden — it must stay at index 2, not move below tools
        const rows = buildCustomizeRows(['onboarding', 'glance', 'seo', 'tools'])
        expect(rows.map(r => r.id)).toEqual(['onboarding', 'glance', 'traffic', 'seo', 'tools', 'orders'])
        expect(rows.find(r => r.id === 'traffic')?.visible).toBe(false)
    })

    it('honours saved order of visible blocks within the schema frame', () => {
        const rows = buildCustomizeRows(['glance', 'onboarding', 'traffic', 'seo', 'tools'])
        expect(rows.filter(r => r.visible).map(r => r.id)).toEqual(['glance', 'onboarding', 'traffic', 'seo', 'tools'])
    })

    it('[TC-F03.73] keeps the orders block available without Soon, hidden by default', () => {
        const rows = buildCustomizeRows(DEFAULT_DASHBOARD_BLOCKS)
        expect(rows.find(r => r.id === 'orders')?.soon).toBeUndefined()
        expect(rows.find(r => r.id === 'orders')?.visible).toBe(false)
        expect(DEFAULT_DASHBOARD_BLOCKS).not.toContain('orders')
    })
})
