import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/data/industries/route'
import { TEMPLATE_CATEGORY_OPTIONS } from '@/collections/Templates'

// ── Mock Payload CMS ─────────────────────────────────────────────────────────
let mockTemplateDocs: any[] = []

vi.mock('payload', () => ({
    getPayload: vi.fn().mockImplementation(async () => ({
        find: vi.fn().mockImplementation(async () => ({
            docs: mockTemplateDocs,
        })),
    })),
}))

// ── TC-F01-industries: GET /api/data/industries ───────────────────────────────
describe('[TC-F01-industries] GET /api/data/industries', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        mockTemplateDocs = []
    })

    // ── Happy path ───────────────────────────────────────────────────────────

    it('TC-F01-ind-01: returns categories for templates that exist in DB', async () => {
        // Arrange
        mockTemplateDocs = [
            { id: 'tpl-1', name: 'Coffee Delight', category: ['restaurant'] },
            { id: 'tpl-2', name: 'Tech Agency Pro', category: ['tech'] },
        ]

        // Act
        const res = await GET()
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.docs).toBeInstanceOf(Array)

        const values = body.docs.map((d: any) => d.value)
        expect(values).toContain('restaurant')
        expect(values).toContain('tech')
    })

    it('TC-F01-ind-02: returns empty docs array when no templates exist', async () => {
        // Arrange — mockTemplateDocs is already []

        // Act
        const res = await GET()
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.docs).toEqual([])
    })

    it('TC-F01-ind-03: filters out categories that have no matching templates', async () => {
        // Arrange — only "beauty" templates exist, none for "tech" or "fitness"
        mockTemplateDocs = [
            { id: 'tpl-1', name: 'Spa & Glow', category: ['beauty'] },
        ]

        // Act
        const res = await GET()
        const body = await res.json()

        // Assert
        const values = body.docs.map((d: any) => d.value)
        expect(values).toContain('beauty')
        expect(values).not.toContain('tech')
        expect(values).not.toContain('fitness')
        expect(body.docs).toHaveLength(1)
    })

    it('TC-F01-ind-04: returns only unique categories (deduplicates across templates)', async () => {
        // Arrange — two templates with the same category
        mockTemplateDocs = [
            { id: 'tpl-1', name: 'Noodle House', category: ['restaurant'] },
            { id: 'tpl-2', name: 'Burger Joint', category: ['restaurant'] },
        ]

        // Act
        const res = await GET()
        const body = await res.json()

        // Assert
        const restaurantEntries = body.docs.filter((d: any) => d.value === 'restaurant')
        expect(restaurantEntries).toHaveLength(1)
    })

    it('TC-F01-ind-05: each category item has value, label, and icon fields', async () => {
        // Arrange
        mockTemplateDocs = [{ id: 'tpl-1', name: 'SaaS Product', category: ['tech'] }]

        // Act
        const res = await GET()
        const body = await res.json()

        // Assert
        const techEntry = body.docs.find((d: any) => d.value === 'tech')
        expect(techEntry).toBeDefined()
        expect(typeof techEntry.value).toBe('string')
        expect(typeof techEntry.label).toBe('string')
        expect(typeof techEntry.icon).toBe('string')
        // Icon should be the emoji split from TEMPLATE_CATEGORY_OPTIONS label
        const techOption = TEMPLATE_CATEGORY_OPTIONS.find(o => o.value === 'tech')
        const expectedIcon = techOption!.label.split(' ')[0]
        expect(techEntry.icon).toBe(expectedIcon)
    })

    it('TC-F01-ind-06: handles template with multiple categories (array)', async () => {
        // Arrange — one template belongs to multiple industries
        mockTemplateDocs = [
            { id: 'tpl-1', name: 'Health & Fitness Center', category: ['health', 'fitness'] },
        ]

        // Act
        const res = await GET()
        const body = await res.json()

        // Assert
        const values = body.docs.map((d: any) => d.value)
        expect(values).toContain('health')
        expect(values).toContain('fitness')
    })

    it('TC-F01-ind-07: handles template with single category string (not array)', async () => {
        // Arrange — category stored as plain string instead of array
        mockTemplateDocs = [
            { id: 'tpl-1', name: 'Real Estate Pro', category: 'realestate' },
        ]

        // Act
        const res = await GET()
        const body = await res.json()

        // Assert
        const values = body.docs.map((d: any) => d.value)
        expect(values).toContain('realestate')
    })

    it('TC-F01-ind-08: ignores templates with empty or null category', async () => {
        // Arrange — templates with invalid category data
        mockTemplateDocs = [
            { id: 'tpl-1', name: 'No Category', category: null },
            { id: 'tpl-2', name: 'Empty Category', category: '' },
            { id: 'tpl-3', name: 'Valid One', category: ['education'] },
        ]

        // Act
        const res = await GET()
        const body = await res.json()

        // Assert — only education should appear, no crashes from null/empty
        const values = body.docs.map((d: any) => d.value)
        expect(values).toContain('education')
        expect(body.docs).toHaveLength(1)
    })

    // ── Error path ───────────────────────────────────────────────────────────

    it('TC-F01-ind-09: returns 500 with empty docs when Payload throws', async () => {
        // Arrange — simulate DB failure
        const { getPayload } = await import('payload')
        // @ts-ignore
        vi.mocked(getPayload).mockRejectedValueOnce(new Error('DB connection refused'))

        // Act
        const res = await GET()
        const body = await res.json()

        // Assert
        expect(res.status).toBe(500)
        expect(body.docs).toEqual([])
        expect(body.error).toBe('Failed to load industries')
    })
})
