/**
 * TC-09.40 — GH-1458 D2: bulk-create must NOT bypass the publishing gate. Guards the plan's
 * "already safe" finding: BulkCreateModal.buildSavePayload() always sets status:'draft', so the
 * gate is a structural no-op there. If this ever regresses to 'active', Phase 2's server-side
 * productPublishBlocks() guard in updateProductFieldAction would still catch incomplete products,
 * but bulk-created products should never need that fallback in the first place.
 */
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { buildSavePayload } from '@/components/dashboard/BulkCreateModal'

const MINIMAL_PARSED_PRODUCT = {
    selected: true,
    name: 'Bulk Product',
    price: 50,
    category: '',
    variants: [],
}

describe('buildSavePayload — TC-09.40: bulk-create always drafts', () => {
    it('sets status:"draft" regardless of category/media/variant inputs', () => {
        const payload = buildSavePayload(MINIMAL_PARSED_PRODUCT, null, null)
        expect(payload.status).toBe('draft')
    })

    it('sets status:"draft" even when a carton media id and category are supplied', () => {
        const payload = buildSavePayload(MINIMAL_PARSED_PRODUCT, 'carton-1', 'cat-1')
        expect(payload.status).toBe('draft')
    })

    it('sets status:"draft" for variant products too', () => {
        const withVariants = {
            ...MINIMAL_PARSED_PRODUCT,
            variants: [{ name: 'Red', price: 50, sku: 'R-01', stock: 5 }],
        }
        const payload = buildSavePayload(withVariants, null, null)
        expect(payload.status).toBe('draft')
    })
})
