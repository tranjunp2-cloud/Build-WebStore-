import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/data/industries/route'
import { TEMPLATE_CATEGORY_OPTIONS } from '@/collections/Templates'

type IndustryDoc = { value: string; label: string; icon: string }

// ── TC-F01-industries: GET /api/data/industries ───────────────────────────────
describe('[TC-F01-industries] GET /api/data/industries', () => {

    // ── Happy path ───────────────────────────────────────────────────────────

    it('TC-F01-ind-01: returns all template categories from static config', async () => {
        // Act
        const res = await GET()
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.docs).toBeInstanceOf(Array)
        expect(body.docs).toHaveLength(TEMPLATE_CATEGORY_OPTIONS.length)
    })

    it('TC-F01-ind-02: returns categories with correct value fields', async () => {
        // Act
        const res = await GET()
        const body = await res.json()

        // Assert
        const docs = body.docs as IndustryDoc[]
        const values = docs.map((d) => d.value)
        const expectedValues = TEMPLATE_CATEGORY_OPTIONS.map((o) => o.value)
        expect(values).toEqual(expectedValues)
    })

    it('TC-F01-ind-03: each category item has value, label, and icon fields', async () => {
        // Act
        const res = await GET()
        const body = await res.json()

        // Assert
        for (const doc of body.docs) {
            expect(typeof doc.value).toBe('string')
            expect(typeof doc.label).toBe('string')
            expect(typeof doc.icon).toBe('string')
        }
    })

    it('TC-F01-ind-04: icon is extracted from first segment of original label', async () => {
        // Act
        const res = await GET()
        const body = await res.json()

        // Assert — verify icon/label parsing for each entry
        for (let i = 0; i < TEMPLATE_CATEGORY_OPTIONS.length; i++) {
            const option = TEMPLATE_CATEGORY_OPTIONS[i]
            const [expectedIcon, ...labelParts] = option.label.split(' ')
            const doc = body.docs[i]

            expect(doc.value).toBe(option.value)
            expect(doc.icon).toBe(expectedIcon)
            expect(doc.label).toBe(labelParts.join(' '))
        }
    })

    it('TC-F01-ind-05: all category values are unique (no duplicates)', async () => {
        // Act
        const res = await GET()
        const body = await res.json()

        // Assert
        const docs = body.docs as IndustryDoc[]
        const values = docs.map((d) => d.value)
        const uniqueValues = new Set(values)
        expect(uniqueValues.size).toBe(values.length)
    })
})
