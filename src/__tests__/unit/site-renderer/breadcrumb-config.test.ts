import { describe, it, expect } from 'vitest'
import { isBreadcrumbEnabled, buildBreadcrumbConfig } from '@/lib/site-renderer/breadcrumb-config'

// TC-GH2246-01..06 — breadcrumb on/off shared by Editor toggle and live renderer
describe('isBreadcrumbEnabled', () => {
    it('TC-GH2246-01: no config (old store) → off', () => {
        // Arrange / Act / Assert
        expect(isBreadcrumbEnabled(undefined)).toBe(false)
        expect(isBreadcrumbEnabled(null)).toBe(false)
    })

    it('TC-GH2246-02: config without showOnAllPages (legacy data) → on', () => {
        expect(isBreadcrumbEnabled({})).toBe(true)
        expect(isBreadcrumbEnabled({ homeLabel: 'Home' })).toBe(true)
    })

    it('TC-GH2246-03: showOnAllPages false or null → off; true → on', () => {
        expect(isBreadcrumbEnabled({ showOnAllPages: false })).toBe(false)
        expect(isBreadcrumbEnabled({ showOnAllPages: null })).toBe(false)
        expect(isBreadcrumbEnabled({ showOnAllPages: true })).toBe(true)
    })
})

describe('buildBreadcrumbConfig', () => {
    it('TC-GH2246-04: old store edits Home label → saved config stays OFF (no implicit enable)', () => {
        // Arrange
        const changes = { homeLabel: 'Trang chủ' }

        // Act
        const result = buildBreadcrumbConfig(undefined, changes)

        // Assert
        expect(result).toEqual({ homeLabel: 'Trang chủ', showOnAllPages: false })
        expect(isBreadcrumbEnabled(result)).toBe(false)
    })

    it('TC-GH2246-05: old store turns the toggle on → saved config is ON', () => {
        const result = buildBreadcrumbConfig(undefined, { showOnAllPages: true })

        expect(result.showOnAllPages).toBe(true)
        expect(isBreadcrumbEnabled(result)).toBe(true)
    })

    it('TC-GH2246-06: existing config keeps its state and other fields when editing one field', () => {
        const existing = { homeLabel: 'Home', separator: '>', showOnAllPages: true }

        const result = buildBreadcrumbConfig(existing, { separator: '/' })

        expect(result).toEqual({ homeLabel: 'Home', separator: '/', showOnAllPages: true })
    })
})
